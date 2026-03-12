export type ServerResponse = {
    message?: string;
    cause?: object | string
} & ({ errorCode: ServerErrorCodes } | { code: string })

// Codes

export enum ApiCode {
    OK = 'OK',
    CREATED = 'CREATED',
    DESTROYED = 'DESTROYED',
}

// Error Codes
export type ServerErrorCodes = ApiErrorCode | UserErrorCode

export enum ApiErrorCode {
    BAD_REQUEST = "BAD_REQUEST",
    UNAUTHORIZED = "UNAUTHORIZED",
    NOT_FOUND = "NOT_FOUND",
    INTERNAL_SERVER_ERROR = "INTERNAL_SERVER_ERROR",
    METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED",
    SIGNUP_DISABLED = "SIGNUP_DISABLED",
    EXTERNAL_API_ERROR = "EXTERNAL_API_ERROR",
}

export enum UserErrorCode {
    USERNAME_EXISTS = "USERNAME_EXISTS",
    INVALID_USERNAME = "INVALID_USERNAME",
    INVALID_PASSWORD = "INVALID_PASSWORD",
    INVALID_LOGIN = "INVALID_LOGIN",
}