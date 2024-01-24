import {
    auth,
    AuthLevel,
    EventsManager,
    functionWrapper,
    GamesManager,
    HttpError,
    rankingPlayer,
    RankingService,
    RoundManager,
} from '@shared';
import { Request } from 'express';
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

const handler = async (dependencies: Dependencies, body: z.infer<typeof schema>, request: Request) => {
    const game = await dependencies.gamesManager.getGameById(body.game_id);
    if (!game) {
        throw new HttpError(404, 'Game not found');
    }

    if (game.created_by !== request.authToken.uid) {
        throw new HttpError(403, 'You are not the owner of this game');
    }

    const round = await dependencies.roundManager.getLastRoundForGame(game.id);
    if (!round) {
        throw new HttpError(404, 'Round not found');
    }

    if (!round.is_finished) {
        throw new HttpError(403, 'Round is not finished');
    }

    body.current_ranking.sort((a, b) => b.points - a.points);

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

        dependencies.eventsManager.notifyGameOver(ranking);
    }

    return {};
};

export const finishGame = (dependencies: Dependencies) => {
    return auth(AuthLevel.Admin, functionWrapper(schema, handler.bind(null, dependencies)));
};
