import express from 'express';
import cors from 'cors'

const app = express();

app.use(express.json())
app.use(cors())

export = app

app.listen(8080, () => { console.log('Rodando na porta 8080') })