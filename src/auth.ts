import app from './server'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { z } from 'zod'
import { prisma } from "./lib/prisma"
dotenv.config()

export function verifyJWT(req: any, res: any, next: any) {
  const tokenUser = req.headers.keyacess
  if (!tokenUser) return res.status(401).json({ authorized: false, message: 'No token provided.' });

  jwt.verify(tokenUser, process.env.ACCESS_TOKEN_SECRET!, function (err: any, decoded: any) {
    if (err) return res.status(403).json({ authorized: false, message: 'Token de autorização não reconhecido! faça login novamente por favor!' });
    // se tudo estiver ok, salva no request para uso posterior
    next();
  });
}

app.post("/login", async (request, response) => {
  //validação de tipo
  const loginBody = z.object({
    password: z.string(),
    email: z.string()
  })

  const { password, email } = loginBody.parse(request.body)

  const userLogin = await prisma.users.findFirst({
    where: {
      email: email,
      password: password
    }
  })

  if (userLogin) {
    const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET!, {
      expiresIn: 72 * 60 * 60 // 3 dias
    });

    return response.status(200).json({
      message: "autorizado",
      authorized: true,
      userId: userLogin.id,
      token
    })
  }

  return response.json({
    message: "Email ou senha errados",
    authorized: false,
    token: ""
  })

})

app.post("/registration", async (request, response) => {
  const registrationBody = z.object({
    name: z.string(),
    password: z.string(),
    email: z.string()
  })

  const { name, email, password } = registrationBody.parse(request.body)

  const isUser = await prisma.users.findFirst({
    where: {
      email: email
    }
  })

  if (isUser) {
    return response.json({
      message: "Email já cadastrado",
      resgistration: false
    })
  }

  await prisma.users.create({
    data: {
      name,
      email,
      password
    }
  })

  return response.json({
    message: "Cadastrado com sucesso",
    resgistration: true
  })
})