import app from './server'
//biblioteca para formatar datas
import dayjs from "dayjs"
//zod é uma biblioteca para validar dados
import { z } from 'zod'
import { prisma } from "./lib/prisma"
import { verifyJWT } from './auth';

app.post('/habits/:id', verifyJWT, async (req, res) => {
  //zod automaticamente cria uma especie de type com validação
  const createHabitBody = z.object({
    title: z.string(),
    weekDays: z.array(z.number().min(0).max(6))
  })

  const userId = parseInt(req.params.id.replace("id=", ''))
  if (!userId) {
    return res.status(100).json({ message: "erro, usuário não encontrado!" })
  }

  const { title, weekDays } = createHabitBody.parse(req.body)

  const user = await prisma.users.findFirst({
    where: {
      id: userId,
    }
  })

  if (!user) {
    return res.status(500).json({
      message: "user no found"
    })
  } else {
    const day = dayjs().startOf('day').toDate()
    //cria dado na tabela de habitos e o relacionamento na tabela de dias da semana
    await prisma.habit.create({
      data: {
        title: title,
        user_id: userId,
        created_at: day,
        weekDays: {
          create: weekDays.map(weekday => {
            return {
              week_day: weekday
            }
          })
        }
      }
    })

    let dayUser = await prisma.day.findFirst({
      where: {
        date: day,
        user_id: userId
      }
    })
    if (!dayUser)
      await prisma.day.create({
        data: {
          date: day,
          user_id: userId
        }
      })
  }

  return res.json({
    message: "Sucesso"
  })
})

app.get('/day/:id', verifyJWT, async (request, response) => {

  const getDayBody = z.object({
    date: z.coerce.date()
  })

  const userId = parseInt(request.params.id.replace("id=", ''))
  if (!userId) {
    return response.status(100).json({ message: "erro, usuário não encontrado!" })
  }

  const { date } = getDayBody.parse(request.query)

  const parseDate = dayjs(date).startOf('day')
  const weekDay = parseDate.get('day')

  const possibleHabits = await prisma.habit.findMany({
    where: {
      created_at: {
        lte: date,
      },
      user_id: userId,
      weekDays: {
        some: {
          week_day: weekDay,
        }
      }
    }
  })

  const Day = await prisma.day.findFirst({
    where: {
      date: parseDate.toDate(),
      user_id: userId
    },
    include: {
      dayHabits: true,
    }
  })

  const completedHabits = Day?.dayHabits.map(dayHabits => {
    return dayHabits.habit_id
  }) ?? []

  return response.json(
    {
      possibleHabits,
      completedHabits
    }
  )
})

app.get('/summary/:id', verifyJWT, async (req, res) => {
  const userId = parseInt(req.params.id.replace("id=", ''))
  if (!userId) {
    return res.status(500).json({ message: "erro, usuário não encontrado!" })
  }

  const summary = await prisma.$queryRaw`
      SELECT D.id, D.date,
      (
        SELECT 
        cast(count(*) as float)
        FROM day_habits DH
        WHERE DH.day_id = D.id
      ) as completed,
      (
        SELECT
        cast(count(*) as float)
        FROM habit_week_days HWD
        JOIN habits H
        ON H.id = HWD.habit_id
        WHERE HWD.week_day = dayofweek(D.date)-1
        AND H.created_at = D.date
        AND H.user_id = ${userId}
      ) as amout
       FROM days D
       WHERE D.user_id=${userId};
    `
  return res.json(summary);
})

app.patch('/habits/:id/toggle', verifyJWT, async (req, res) => {
  const habitId = parseInt(req.params.id.replace("id=", ''))

  if (!habitId) {
    return res.status(500).json({ message: "erro, hábito não encontrado!" })
  }

  const today = dayjs().startOf('day').toDate()

  const habit = await prisma.habit.findFirst({
    where: {
      id: habitId
    }
  })

  let day = await prisma.day.findFirst({
    where: {
      date: today,
      user_id: habit!.user_id
    }
  })

  const dayHabitComplete = await prisma.dayHabit.findUnique({
    where: {
      day_id_habit_id: {
        day_id: day!.id,
        habit_id: habitId
      }
    }
  })
  if (dayHabitComplete) {
    //remove a marcação de completado
    await prisma.dayHabit.delete({
      where: {
        id: dayHabitComplete.id
      }
    })

  } else {
    //completa um hábito
    await prisma.dayHabit.create({
      data: {
        day_id: day!.id,
        habit_id: habitId
      }
    })
  }
  return res.json({
    message: "sucesso"
  }
  )
})