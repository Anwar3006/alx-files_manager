const redisClient = require('../utils/redis')
const dbClient = require('../utils/db')


const getStatus = (req, res) => {
    res.status(200).json(
        { 
            "redis": redisClient.isAlive(),
            "db": dbClient.isAlive() 
        }
    )
}

const getStats = async (req, res) => {
    const countUsers = await dbClient.nbUsers();
    const countFiles = await dbClient.nbUsers();
    res.status(200).json(
        {
            'users': countUsers,
            'files': countFiles
        }
    )
}

module.exports = {
    getStatus,
    getStats
}