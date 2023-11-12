import { functionWrapper, GamesManager, HttpError, RoundManager } from '@shared';
import { z } from 'zod';

// Allow to answer 5 seconds after round finished, because of lambda cold start
// const ANSWER_LATE_ALLOWED_MS = 5000;

interface Dependencies {
    gamesManager: GamesManager;
    roundManager: RoundManager;
}

const schema = z.object({
    game_id: z.string().min(1),
    token: z.string().min(1),
    answer_index: z.number().int().min(0),
    was_hint_used: z.boolean().default(false),
    timestamp: z.string().min(1),
});

const handler = async (dependencies: Dependencies, body: z.infer<typeof schema>) => {
    const game = await dependencies.gamesManager.getGameById(body.game_id);
    if (!game) {
        throw new HttpError(404, 'Game not found');
    }

    const round = await dependencies.roundManager.getLastRoundForGame(game.id);
    if (!round) {
        throw new HttpError(403, 'Game not started');
    }

    if (round.is_finished) {
        throw new HttpError(403, 'Round finished');
    }

    // const roundFinishedAtMs = round.started_at.getTime() + round.time_in_seconds * 1000;
    // const maxAllowedAnswerTimeMs = roundFinishedAtMs + ANSWER_LATE_ALLOWED_MS;
    // if (roundFinishedAtMs < maxAllowedAnswerTimeMs) {
    // throw new HttpError(403, 'Round finished');
    // }

    const player = game.players?.find((player) => player.token === body.token);
    if (!player) {
        throw new HttpError(403, 'Player not found');
    }

    const answer = await dependencies.roundManager.getUserAnswer(game.id, round.round_index, player.token);
    if (answer) {
        throw new HttpError(403, 'Already answered');
    }

    await dependencies.roundManager.createAnswer({
        game_id: game.id,
        for_round_index: round.round_index,
        player_token: player.token,
        was_hint_used: body.was_hint_used,
        answer_index: body.answer_index,
        answer_time: new Date(body.timestamp),
    });

    return {};
};

export const sendAnswer = (dependencies: Dependencies) => {
    return functionWrapper(schema, handler.bind(null, dependencies));
};
