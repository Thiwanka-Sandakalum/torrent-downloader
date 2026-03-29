export const logger = {
    info: (message: any, meta?: any) => console.log(message, meta),
    error: (message: any, meta?: any) => console.error(message, meta),
    warn: (message: any, meta?: any) => console.warn(message, meta),
    debug: (message: any, meta?: any) => console.debug(message, meta),
};
