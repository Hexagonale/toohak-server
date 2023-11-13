import {
    EventsManager,
    functionWrapper,
    GamesManager,
    HttpError,
    rankingPlayer,
    RankingService,
    RoundManager,
} from '@shared';
import { z } from 'zod';

interface Dependencies {
    gamesManager: GamesManager;
    eventsManager: EventsManager;
    roundManager: RoundManager;
    rankingService: RankingService;
}

const schema = z.object({
    game_id: z.string().min(1),
    current_ranking: z.array(rankingPlayer),
});

interface EndGameResult {
    player_token: string;
    player_username: string;
    points: number;
    questions_answered: number;
    questions_answered_correctly: number;
    average_answer_time: number;
}

const handler = async (
    dependencies: Dependencies,
    body: z.infer<typeof schema>
): Promise<{ results: EndGameResult[] }> => {
    // const authData = request.headers['authorization']?.split(' ')[1];
    // if (!authData) {
    //     throw new HttpError(401, 'Unauthenticated');
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

    if (!round.is_finished) {
        throw new HttpError(403, 'Round is not finished');
    }

    body.current_ranking.sort((a, b) => b.points - a.points);

    const results: EndGameResult[] = [];

    for (const player of game.players ?? []) {
        const indexInRanking = body.current_ranking.findIndex((rankingPlayer) => rankingPlayer.token === player.token);
        const currentPoints = body.current_ranking[indexInRanking].points;

        const ranking = await dependencies.rankingService.calculateEndGameRanking({
            gameId: game.id,
            userToken: player.token,
            didPlayerLost: false,
            totalPoints: currentPoints ?? 0,
            finalPosition: indexInRanking + 1,
        });

        results.push({
            player_token: player.token,
            player_username: player.username,
            points: ranking.totalPoints,
            questions_answered: ranking.questionsAnswered,
            questions_answered_correctly: ranking.questionsAnsweredCorrectly,
            average_answer_time: ranking.averageAnswerTime,
        });

        dependencies.eventsManager.notifyGameOver(ranking);
    }

    results.sort((a, b) => b.points - a.points);

    return {
        results,
    };
};

export const finishGame = (dependencies: Dependencies) => {
    return functionWrapper(schema, handler.bind(null, dependencies));
};
