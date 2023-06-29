const Redis = require('redis')
const {promisify} = require('util')

class RedisClient {
    constructor() {
        this.success = true
        this.client = Redis.createClient()
        this.client.on('error', err => {
            console.log('Redis Client Error', err)
            this.success = false;
        });
        this.client.on('connect', () => {
            this.success = true;
        });
        this.client.getAsync = promisify(this.client.GET).bind(this.client)
        this.client.setAsync = promisify(this.client.SETEX).bind(this.client)
        this.client.delAsync = promisify(this.client.DEL).bind(this.client)
    }
    
    isAlive(){
        return this.success
    }
    
    async get(key){
        const value = this.client.getAsync(key);
        return value; 
    }

    async set(key, value, duration) {
        try {
            this.client.setAsync(key, duration, value);
        } catch (error) {
            return error;
        }
    }

    async del(key) {
        try {
            const getKey = await this.get(key);
            if (getKey) {
                this.client.delAsync(key);
            }
        } catch (error) {
            return error;
        }
    }
}

const redisClient = new RedisClient()
module.exports = redisClient