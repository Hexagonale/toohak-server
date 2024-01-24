import { Logger } from '@shared';
import { Request } from 'express';
import { Duplex } from 'stream';
import ws from 'ws';

export class EventsManager {
    private constructor() {}

    static readonly instance = new EventsManager();

    private readonly logger = new Logger('EventsManager');

    private readonly server = new ws.Server({ noServer: true });

    private readonly users: { [key: string]: ws | undefined } = {};

    async registerUser(
        predicate: (handshake: string) => Promise<string | null>,
        request: Request,
        socket: Duplex,
        head: Buffer
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.server.handleUpgrade(request, socket, head, async (webSocket) => {
                    this.logger.info('registerUser, waiting for handshake...');

                    const handshake = await new Promise<string>((resolve) => {
                        webSocket.on('message', (msg) => {
                            resolve(msg.toString());
                        });
                    });

                    const token = await predicate(handshake);
                    if (!token) {
                        this.logger.warning('registerUser, token not found', { token });

                        webSocket.close();
                        return;
                    }

                    this.logger.info('registerUser, handled upgrade', { token });

                    webSocket.on('close', () => this.onClose(token));
                    webSocket.on('error', (error) => this.onError(token, error));

                    this.users[token] = webSocket;

                    resolve();
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async notifyPlayerJoined(adminToken: string, username: string): Promise<void> {
        try {
            const data = { username };

            this.logger.info('notifyPlayerJoined', { adminToken, data });

            await this.send(
                adminToken,
                JSON.stringify({
                    type: 'PLAYER_JOINED',
                    data,
                })
            );
        } catch (error) {
            this.logger.error('notifyPlayerJoined, could not send notification', { error });
        }
    }

    async notifyQuestion({
        userToken,
        question,
        answers,
        hint,
        isDouble,
        finishWhen,
    }: {
        userToken: string;
        question: string;
        answers: string[];
        hint: string | null;
        isDouble: boolean;
        finishWhen: Date;
    }): Promise<void> {
        try {
            const data = {
                question,
                is_double: isDouble,
                answers,
                finish_when: finishWhen.toISOString(),
                hint,
            };

            this.logger.info('notifyQuestion', { userToken, data });

            await this.send(userToken, JSON.stringify({ type: 'QUESTION_SENT', data }));
        } catch (error) {
            this.logger.error('notifyGameOver, could not send notification', { error });
        }
    }

    async notifyRoundFinished({
        userToken,
        wasAnswerCorrect,
        pointsForThisRound,
        totalPoints,
        currentPosition,
        answeredNth,
    }: {
        userToken: string;
        wasAnswerCorrect: boolean | null;
        pointsForThisRound: number;
        totalPoints: number;
        currentPosition: number;
        answeredNth: number | null;
    }): Promise<void> {
        try {
            const data = {
                was_answer_correct: wasAnswerCorrect,
                points_for_this_round: pointsForThisRound,
                total_points: totalPoints,
                current_position: currentPosition,
                answered_nth: answeredNth,
            };

            this.logger.info('notifyRoundFinished', { userToken, data });

            this.send(userToken, JSON.stringify({ type: 'ROUND_FINISHED', data }));
        } catch (error) {
            this.logger.error('notifyGameOver, could not send notification', { error });
        }
    }

    async notifyGameOver({
        userToken,
        didPlayerLost,
        totalPoints,
        finalPosition,
        questionsAnswered,
        questionsAnsweredCorrectly,
        averageAnswerTime,
    }: {
        userToken: string;
        didPlayerLost: boolean;
        totalPoints: number;
        finalPosition: number;
        questionsAnswered: number;
        questionsAnsweredCorrectly: number;
        averageAnswerTime: number;
    }): Promise<void> {
        try {
            const data = {
                did_player_lost: didPlayerLost,
                total_points: totalPoints,
                final_position: finalPosition,
                questions_answered: questionsAnswered,
                questions_answered_correctly: questionsAnsweredCorrectly,
                average_answer_time: averageAnswerTime,
            };

            this.logger.info('notifyGameOver', { userToken, data });

            this.send(
                userToken,
                JSON.stringify({
                    type: 'GAME_OVER',
                    data,
                })
            );
        } catch (error) {
            this.logger.error('notifyGameOver, could not send notification', { error });
        }
    }

    private send(token: string, data: string) {
        const webSocket = this.users[token];
        if (!webSocket) {
            this.logger.error('send, webSocket not found', { token });

            return;
        }

        webSocket.send(data);
    }

    private onClose(token: string) {
        this.logger.info('onClose, websocket closed', { token });

        const webSocket = this.users[token];
        if (!webSocket) {
            this.logger.warning('onClose, webSocket not found', { token });

            return;
        }

        delete this.users[token];
    }

    private onError(token: string, error: Error) {
        this.logger.error('onError, websocket errored', { token, error });

        const webSocket = this.users[token];
        if (!webSocket) {
            this.logger.warning('onError, webSocket not found', { token });

            return;
        }

        webSocket.close();
        delete this.users[token];
    }
}
