import { auth, AuthLevel, EventsManager, functionWrapper, GamesManager, HttpError, RoundManager } from '@shared';
import { Request } from 'express';
import { z } from 'zod';

const DELAY_COMPENSATION_S = 1;

interface Dependencies {
    gamesManager: GamesManager;
    eventsManager: EventsManager;
    roundManager: RoundManager;
}

const schema = z.object({
    game_id: z.string().min(1),
    question: z.string().min(1),
    hint: z.string().min(1).nullable().default(null),
    is_double: z.boolean().default(false),
    answers: z.array(z.string().min(1)).min(2),
    time_in_seconds: z.number().int().positive(),
    is_hardcore: z.boolean(),
});

const handler = async (dependencies: Dependencies, body: z.infer<typeof schema>, request: Request) => {
    const timeInSeconds = body.time_in_seconds + DELAY_COMPENSATION_S;

    const game = await dependencies.gamesManager.getGameById(body.game_id);
    if (!game) {
        throw new HttpError(404, 'Game not found');
    }

    if (game.created_by !== request.authToken.uid) {
        throw new HttpError(403, 'You are not the owner of this game');
    }

    const lastRound = await dependencies.roundManager.getLastRoundForGame(game.id);
    if (lastRound && !lastRound.is_finished) {
        throw new HttpError(403, 'Previous round is not finished');
    }

    const lastRoundIndex = lastRound?.round_index ?? 0;

    await dependencies.roundManager.createRound({
        game_id: game.id,
        round_index: lastRoundIndex + 1,
        started_at: new Date(),
        time_in_seconds: timeInSeconds,
        is_hardcore: body.is_hardcore,
        is_finished: false,
    });

    const finishWhen = new Date(Date.now() + timeInSeconds * 1000);

    for (const player of game?.players ?? []) {
        dependencies.eventsManager.notifyQuestion({
            userToken: player.token,
            question: body.question,
            answers: body.answers,
            hint: body.hint,
            isDouble: body.is_double,
            finishWhen,
        });
    }

    return {
        finish_when: finishWhen.toISOString(),
    };
};

export const sendQuestion = (dependencies: Dependencies) => {
    return auth(AuthLevel.Admin, functionWrapper(schema, handler.bind(null, dependencies)));
};
