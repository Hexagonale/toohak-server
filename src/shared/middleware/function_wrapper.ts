import { HttpError } from '@shared';
import { Request, Response } from 'express';
import { z, ZodType } from 'zod';

type Handler<T extends ZodType> = (body: z.infer<T>, request: Request, response: Response) => Promise<unknown>;

export const functionWrapper = (schema: z.Schema, handler: Handler<typeof schema>) => {
    return async (req: Request, res: Response): Promise<void> => {
        const parseResult = await schema.safeParseAsync(req.body);
        if (!parseResult.success) {
            res.status(400).send(parseResult.error);

            return;
        }

        try {
            const result = await handler(parseResult.data, req, res);

            res.status(200).send(result);
        } catch (error) {
            if (error instanceof HttpError) {
                res.status(error.status).send({ error: error.message });

                return;
            }

            if (error instanceof Error) {
                res.status(500).send({
                    error: error.message,
                });

                return;
            }

            res.status(500).send({ error });
        }
    };
};
