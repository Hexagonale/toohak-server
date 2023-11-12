export class HttpError extends Error {
    constructor(
        readonly status: number,
        readonly error: object | string
    ) {
        super(error.toString());
    }
}
