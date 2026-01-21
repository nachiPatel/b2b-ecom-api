import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json());

app.get('/health', (_, res) => {
    res.json({status:"ok"});
})

const port = process.env.PORT || 3000;

app.listen(port, ()=>{
    console.log(`App is listing on port ${port}`);
})
