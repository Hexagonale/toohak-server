import { EventsManager, functionWrapper, GamesManager, HttpError, Logger } from '@shared';
import { randomBytes } from 'crypto';
import { z } from 'zod';

interface Dependencies {
    gamesManager: GamesManager;
    eventsManager: EventsManager;
}

const schema = z.object({
    code: z.string().min(1),
    username: z.string().min(1),
});

const logger = new Logger('JoinGame');

const handler = async (dependencies: Dependencies, body: z.infer<typeof schema>) => {
    const { code, username } = body;

    const game = await dependencies.gamesManager.getGameByCode(code);
    if (!game) {
        throw new HttpError(404, 'Game not found');
    }

    if (game.sign_up_blocked) {
        throw new HttpError(403, 'Sign up blocked');
    }

    const playerWithSameName = game.players?.find(
        (player) => player.username.trim().toLowerCase() === username.trim().toLowerCase()
    );
    if (playerWithSameName) {
        throw new HttpError(403, 'Username already taken');
    }

    const token = randomBytes(64).toString('base64');

    logger.info('Joining game...', { game, username, token });

    await dependencies.gamesManager.addPlayerToGame(game.id, {
        username,
        token,
    });

    await dependencies.eventsManager.notifyPlayerJoined(game.admin_token, username);

    return {
        game_id: game.id,
        token,
    };
};

export const joinGame = (dependencies: Dependencies) => {
    return functionWrapper(schema, handler.bind(null, dependencies));
};
