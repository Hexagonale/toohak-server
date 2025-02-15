import { auth, AuthLevel, functionWrapper, GamesManager, HttpError, Logger } from '@shared';
import { randomBytes } from 'crypto';
import { Request } from 'express';
import { z } from 'zod';

interface Dependencies {
    gamesManager: GamesManager;
}

const schema = z.object({
    template_id: z.string().min(1),
});

const logger = new Logger('createGame');

const handler = async (dependencies: Dependencies, body: z.infer<typeof schema>, request: Request) => {
    const { authToken } = request;
    if (!authToken) {
        throw new HttpError(401, 'No auth token!');
    }

    const code = Math.round(Math.random() * 999_999)
        .toString()
        .padStart(6, '0');
    const token = randomBytes(64).toString('base64url');

    logger.info('Creating game...', { code, token });

    const game = await dependencies.gamesManager.createGame({
        id: '',
        code,
        admin_token: token,
        game_template_id: body.template_id,
        players: [],
        sign_up_blocked: false,
        created_by: authToken.uid,
    });

    logger.info('Created game', { game });

    return {
        game_id: game.id,
        token,
    };
};

export const createGame = (dependencies: Dependencies) => {
    return auth(AuthLevel.Admin, functionWrapper(schema, handler.bind(null, dependencies)));
};
