
if (process.env.MONGO_URI === undefined) {
    throw new Error('MONGO_URI is not defined in the environment variables');
}

if (process.env.PORT === undefined) {
    throw new Error('PORT is not defined in the environment variables');
}

if (process.env.JWT_TOKEN_SECRET === undefined) {
    throw new Error('JWT_SECRET is not defined in the environment variables');
}


const config = {
    MONGO_URI: process.env.MONGO_URI,
    PORT: process.env.PORT,
    JWT_TOKEN_SECRET: process.env.JWT_TOKEN_SECRET
}

module.exports = config; 