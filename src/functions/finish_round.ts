import {
    EventsManager,
    functionWrapper,
    GamesManager,
    HttpError,
    Logger,
    RankingPlayer,
    rankingPlayer,
    RankingService,
    RoundManager,
} from '@shared';
import { z } from 'zod';

interface Dependencies {
    gamesManager: GamesManager;
    roundManager: RoundManager;
    eventsManager: EventsManager;
    rankingService: RankingService;
}

const schema = z.object({
    game_id: z.string().min(1),
    correct_answer_index: z.number().int().min(0),
    max_points: z.number().int().positive(),
    current_ranking: z.array(rankingPlayer),
});

const logger = new Logger('FinishRound');

const handler = async (
    dependencies: Dependencies,
    body: z.infer<typeof schema>
): Promise<{ ranking: RankingPlayer[] }> => {
    // const authData = request.auth;
    // if (!authData) {
    //     throw new HttpsError('unauthenticated', 'Unauthenticated');
    // }

    const game = await dependencies.gamesManager.getGameById(body.game_id);
    if (!game) {
        throw new HttpError(404, 'Game not found');
    }

    // if (game.created_by !== authData.uid) {
    //     throw new HttpError(403, 'You are not the owner of this game');
    // }

    const round = await dependencies.roundManager.getLastRoundForGame(game.id);
    if (!round) {
        throw new HttpError(404, 'Round not found');
    }

    if (round.is_finished) {
        throw new HttpError(403, 'Round already finished');
    }

    await dependencies.roundManager.finishRound(round, body.correct_answer_index);

    const ranking = await dependencies.rankingService.calculateRanking({
        game,
        round,
        correctAnswerIndex: body.correct_answer_index,
        maxPoints: body.max_points,
        currentPoints: Object.fromEntries(
            body.current_ranking.map((rankingPlayer) => [rankingPlayer.token, rankingPlayer.points])
        ),
    });

    const finalRanking: RankingPlayer[] = [];

    const notificationPromises: Promise<void>[] = [];
    for (const endGameRanking of ranking.endGame) {
        notificationPromises.push(dependencies.eventsManager.notifyGameOver(endGameRanking));

        const player = game.players?.find((player) => player.token === endGameRanking.userToken);
        if (!player) {
            logger.error('Player not found in the game', { endGameRanking });

            continue;
        }

        await dependencies.gamesManager.removePlayerFromGame(game.id, player);

        finalRanking.push({
            token: endGameRanking.userToken,
            username: player.username,
            points: endGameRanking.totalPoints,
            round_lost: round.round_index,
        });
    }

    for (const endRoundRanking of ranking.endRound) {
        notificationPromises.push(dependencies.eventsManager.notifyRoundFinished(endRoundRanking));

        const player = game.players?.find((player) => player.token === endRoundRanking.userToken);
        if (!player) {
            logger.error('Player not found in the game', { endRoundRanking });

            continue;
        }

        finalRanking.push({
            token: endRoundRanking.userToken,
            username: player.username,
            points: endRoundRanking.totalPoints,
            round_lost: null,
        });
    }

    await Promise.all(notificationPromises);

    return {
        ranking: finalRanking,
    };
};

export const finishRound = (dependencies: Dependencies) => {
    return functionWrapper(schema, handler.bind(null, dependencies));
};
