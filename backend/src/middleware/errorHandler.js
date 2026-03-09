import logger from '../config/logger.js';

function errorHandler(err, req, res, _next) {
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal server error';

    logger.error('Request error', {
        statusCode,
        message,
        path: req.path,
        method: req.method,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    });

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    });
}

export default errorHandler;
