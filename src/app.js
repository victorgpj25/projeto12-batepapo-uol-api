import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { MongoClient } from "mongodb"
import dayjs from "dayjs"
import joi from "joi"

dotenv.config()

const app = express()
app.use(express.json())
app.use(cors())

const mongoClient = new MongoClient(process.env.MONGO_URL)
let db

mongoClient.connect().then(() => {
	db = mongoClient.db("BatePapoUOL")
})

app.post("/participants", async (req, res) => {

    const newParticipantSchema = joi.object({
        name: joi.string().required(),
        lastStatus: joi.number()
    })

    const newParticipant = {
		name: req.body.name,
		lastStatus: Date.now()
	}
    const newParticipantMessage = {
        from: req.body.name,
        to: "Todos",
        text: "entra na sala...",
        type: "status", 
        time: dayjs(Date.now()).format("HH:mm:ss")
	}

    const validation = newParticipantSchema.validate(newParticipant)

    if (validation.error) {
        console.log(validation.error.details)
        res.sendStatus(422)
        return
    }

    const nameAlreadyExists = await db.collection("participants").find({name: req.body.name}).toArray()

    if (nameAlreadyExists.length) {
        res.sendStatus(409)
        return
    }

    db.collection("participants").insertOne(newParticipant)
    db.collection("messages").insertOne(newParticipantMessage)
    res.sendStatus(201);
})

app.get("/participants", async (req, res) => {

    const allParticipants = await db.collection("participants").find().toArray()

    res.send(allParticipants)
})

app.post("/messages", async (req, res) => {

    const allParticipants = await db.collection("participants").find().toArray()
    const participantsNames = []
    allParticipants.map( participant => participantsNames.push(participant.name) )

    const newMessageSchema = joi.object({
        from: joi.string().valid(...participantsNames).required(),
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid(...["message", "private_message"]).required(),
        time: joi.string()
    })

    const newMessage = {
        from: req.headers.user,
        to: req.body.to,
        text: req.body.text,
        type: req.body.type, 
        time: dayjs(Date.now()).format("HH:mm:ss")
	}

    const validation = newMessageSchema.validate(newMessage)

    if (validation.error) {
        console.log(validation.error.details)
        res.sendStatus(422)
        return
    }

    db.collection("messages").insertOne(newMessage)
    res.sendStatus(201);
})

app.get("/messages", async (req, res) => {
    const user = req.headers.user
    const allMessages = await db.collection("messages").find().toArray()

    function isDisplayable (message) {
        return (message.type === "message" || message.type === "status" || message.to === "Todos" || message.to === user || message.from === user)
    }

    const displayableMessages = allMessages.filter(isDisplayable)

    if (req.query.limit) {
        const limit = parseInt(req.query.limit)
        const lastDisplayableMessages = displayableMessages.slice(0, limit)
        res.send(lastDisplayableMessages)
        return
    }

    res.send(displayableMessages)
})

app.post("/status", async (req, res) => {
    const user = await db.collection("participants").findOne({ name: req.headers.user })
    if (!user) {
        res.sendStatus(404)
        return
    }

    await db.collection("participants").updateOne({ 
        _id: user._id 
    }, { $set: {lastStatus: Date.now()} })
            
    res.sendStatus(200)
})

setInterval(removeInactiveParticipants, 15000)

async function removeInactiveParticipants () {
    const inactiveParticipants = await db.collection("participants").find({lastStatus: {$lt: Date.now() - 10000} }).toArray()
    inactiveParticipants.map(participant => {
        const removedParticipantMessage = {
            from: participant.name,
            to: "Todos",
            text: "sai da sala...",
            type: "status", 
            time: dayjs(Date.now()).format("HH:mm:ss")
        }
        db.collection("messages").insertOne(removedParticipantMessage)
        db.collection("participants").deleteOne({name: participant.name})
    })
}



app.listen(5000);