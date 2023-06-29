const express = require('express')
const app = express()
const router = require('./routes/index')
const PORT = process.env.PORT || 5000

//middleware
app.use(express.json())
app.use('/', router)


app.listen(PORT, () => {
    try {
        console.log(`Server started on port: ${PORT}...`);
    } catch (error) {
        console.error(error);
    }
})