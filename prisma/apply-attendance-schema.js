const { PrismaClient } = require("@prisma/client")
const prisma = new PrismaClient()

async function main() {
  const statements = [
    `DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public."Role" AS ENUM ('ADMIN', 'PERSONNEL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttendanceStatus' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public."AttendanceStatus" AS ENUM ('OPEN', 'CLOSED');
  END IF;
END $$`,
    `CREATE TABLE IF NOT EXISTS public.shifts (
      id SERIAL PRIMARY KEY,
      name VARCHAR(80) NOT NULL UNIQUE,
      start_minute INTEGER NOT NULL,
      end_minute INTEGER NOT NULL,
      created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS public.users (
      id SERIAL PRIMARY KEY,
      tc_kimlik VARCHAR(11) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      password_hash TEXT NOT NULL,
      role public."Role" NOT NULL DEFAULT 'PERSONNEL',
      qr_token VARCHAR(128) NOT NULL UNIQUE,
      shift_id INTEGER REFERENCES public.shifts(id) ON DELETE SET NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS public.attendance_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      shift_id INTEGER REFERENCES public.shifts(id) ON DELETE SET NULL,
      check_in_at TIMESTAMPTZ(6) NOT NULL,
      check_out_at TIMESTAMPTZ(6),
      work_date DATE NOT NULL,
      status public."AttendanceStatus" NOT NULL DEFAULT 'OPEN',
      late_minutes INTEGER NOT NULL DEFAULT 0,
      overtime_minutes INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT now()
    )`,
    `CREATE INDEX IF NOT EXISTS users_role_idx ON public.users(role)`,
    `CREATE INDEX IF NOT EXISTS users_shift_id_idx ON public.users(shift_id)`,
    `CREATE INDEX IF NOT EXISTS attendance_logs_user_id_status_idx ON public.attendance_logs(user_id, status)`,
    `CREATE INDEX IF NOT EXISTS attendance_logs_work_date_idx ON public.attendance_logs(work_date)`,
    `CREATE INDEX IF NOT EXISTS attendance_logs_shift_id_idx ON public.attendance_logs(shift_id)`,
  ]

  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement)
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
