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

const newParticipantSchema = joi.object({
    name: joi.string().required(),
    lastStatus: joi.number()
  })

app.post("/participants", async (req, res) => {

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




app.listen(5000);