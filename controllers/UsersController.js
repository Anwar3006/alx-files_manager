const dbClient = require('../utils/db')
const sha1 = require('sha1');
const redisClient = require('../utils/redis');
const ObjectId = require('mongodb').ObjectID


const postNew = async (req, res) => {
    const { email, password } = req.body;
    const usersCollection = await dbClient.usersCollection();

    if (!email) {
        return res.status(400).json({error: 'Missing email'})
    }
    if (!password) {
        return res.status(400).json({error: 'Missing password'})
    }

 
    const found = await usersCollection.findOne({ email })
    if (found) {
        return res.status(400).json({error: 'Already exists'})
    }

    const hashPassword = sha1(password)
    const inserted = await usersCollection.insertOne({
        email,
        password : hashPassword
    })
    const userId = inserted.insertedId.toString()
    res.status(201).json({'id': userId, email})
}

const getMe = async (req, res) => {
    const token = req.headers['x-token']
    const usersCollection = await dbClient.usersCollection();

    const key = `auth_${token}`
    const o_id = new ObjectId(await redisClient.get(key))
    const getUser = await usersCollection.findOne({ '_id': o_id })

    if (!getUser) {
        return res.status(401).json({ error: 'Unauthorized' })
    }

    res.status(200).json({ 'id': getUser['_id'], 'email': getUser['email'] })
}


module.exports = {
    postNew,
    getMe
}