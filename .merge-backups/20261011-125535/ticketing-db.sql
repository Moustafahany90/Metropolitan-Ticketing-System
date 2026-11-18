--
-- PostgreSQL database dump
--

\restrict dIUfk5f4VdHaLkOc9kd6y6PLwoQqofEeEdGVe7hLskAc7IECkhCKFFvXkflIlVD

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: Priority; Type: TYPE; Schema: public; Owner: ticketing
--

CREATE TYPE public."Priority" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'URGENT'
);


ALTER TYPE public."Priority" OWNER TO ticketing;

--
-- Name: Role; Type: TYPE; Schema: public; Owner: ticketing
--

CREATE TYPE public."Role" AS ENUM (
    'EMPLOYEE',
    'TECHNICIAN'
);


ALTER TYPE public."Role" OWNER TO ticketing;

--
-- Name: TicketStatus; Type: TYPE; Schema: public; Owner: ticketing
--

CREATE TYPE public."TicketStatus" AS ENUM (
    'OPEN',
    'IN_PROGRESS',
    'RESOLVED',
    'CLOSED'
);


ALTER TYPE public."TicketStatus" OWNER TO ticketing;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Category; Type: TABLE; Schema: public; Owner: ticketing
--

CREATE TABLE public."Category" (
    id integer NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Category" OWNER TO ticketing;

--
-- Name: Category_id_seq; Type: SEQUENCE; Schema: public; Owner: ticketing
--

CREATE SEQUENCE public."Category_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Category_id_seq" OWNER TO ticketing;

--
-- Name: Category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ticketing
--

ALTER SEQUENCE public."Category_id_seq" OWNED BY public."Category".id;


--
-- Name: Comment; Type: TABLE; Schema: public; Owner: ticketing
--

CREATE TABLE public."Comment" (
    id integer NOT NULL,
    content text NOT NULL,
    "ticketId" integer NOT NULL,
    "userId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Comment" OWNER TO ticketing;

--
-- Name: Comment_id_seq; Type: SEQUENCE; Schema: public; Owner: ticketing
--

CREATE SEQUENCE public."Comment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Comment_id_seq" OWNER TO ticketing;

--
-- Name: Comment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ticketing
--

ALTER SEQUENCE public."Comment_id_seq" OWNED BY public."Comment".id;


--
-- Name: Department; Type: TABLE; Schema: public; Owner: ticketing
--

CREATE TABLE public."Department" (
    id integer NOT NULL,
    name text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Department" OWNER TO ticketing;

--
-- Name: Department_id_seq; Type: SEQUENCE; Schema: public; Owner: ticketing
--

CREATE SEQUENCE public."Department_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Department_id_seq" OWNER TO ticketing;

--
-- Name: Department_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ticketing
--

ALTER SEQUENCE public."Department_id_seq" OWNED BY public."Department".id;


--
-- Name: Ticket; Type: TABLE; Schema: public; Owner: ticketing
--

CREATE TABLE public."Ticket" (
    id integer NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    priority public."Priority" DEFAULT 'MEDIUM'::public."Priority" NOT NULL,
    status public."TicketStatus" DEFAULT 'OPEN'::public."TicketStatus" NOT NULL,
    "employeeId" integer NOT NULL,
    "technicianId" integer,
    "departmentId" integer NOT NULL,
    "categoryId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Ticket" OWNER TO ticketing;

--
-- Name: Ticket_id_seq; Type: SEQUENCE; Schema: public; Owner: ticketing
--

CREATE SEQUENCE public."Ticket_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Ticket_id_seq" OWNER TO ticketing;

--
-- Name: Ticket_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ticketing
--

ALTER SEQUENCE public."Ticket_id_seq" OWNED BY public."Ticket".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: ticketing
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    name text NOT NULL,
    email text,
    username text NOT NULL,
    "adSid" text,
    role public."Role" DEFAULT 'EMPLOYEE'::public."Role" NOT NULL,
    "departmentId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "roleLabel" text DEFAULT 'Academic'::text NOT NULL
);


ALTER TABLE public."User" OWNER TO ticketing;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: ticketing
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."User_id_seq" OWNER TO ticketing;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ticketing
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: ticketing
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO ticketing;

--
-- Name: Category id; Type: DEFAULT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."Category" ALTER COLUMN id SET DEFAULT nextval('public."Category_id_seq"'::regclass);


--
-- Name: Comment id; Type: DEFAULT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."Comment" ALTER COLUMN id SET DEFAULT nextval('public."Comment_id_seq"'::regclass);


--
-- Name: Department id; Type: DEFAULT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."Department" ALTER COLUMN id SET DEFAULT nextval('public."Department_id_seq"'::regclass);


--
-- Name: Ticket id; Type: DEFAULT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."Ticket" ALTER COLUMN id SET DEFAULT nextval('public."Ticket_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Data for Name: Category; Type: TABLE DATA; Schema: public; Owner: ticketing
--

COPY public."Category" (id, name, "createdAt", "updatedAt") FROM stdin;
1	Hardware	2026-08-12 09:23:23.54	2026-08-12 09:23:23.54
2	Software	2026-08-12 09:23:23.559	2026-08-12 09:23:23.559
3	Network	2026-08-12 09:23:23.566	2026-08-12 09:23:23.566
4	Printer	2026-08-12 09:23:23.571	2026-08-12 09:23:23.571
5	Account	2026-08-12 09:23:23.576	2026-08-12 09:23:23.576
6	Other	2026-08-12 09:23:23.582	2026-08-12 09:23:23.582
\.


--
-- Data for Name: Comment; Type: TABLE DATA; Schema: public; Owner: ticketing
--

COPY public."Comment" (id, content, "ticketId", "userId", "createdAt", "updatedAt") FROM stdin;
4	done	5	4	2026-08-12 11:52:20.553	2026-08-12 11:52:20.553
9	okey i will check	35	4	2026-08-20 14:20:41.638	2026-08-20 14:20:41.638
10	It will be solved soon	36	9	2026-08-20 14:35:30.874	2026-08-20 14:35:30.874
\.


--
-- Data for Name: Department; Type: TABLE DATA; Schema: public; Owner: ticketing
--

COPY public."Department" (id, name, "createdAt", "updatedAt") FROM stdin;
1	IT	2026-08-12 09:23:23.587	2026-08-12 09:23:23.587
2	Administration	2026-08-12 09:23:23.596	2026-08-12 09:23:23.596
3	Teaching Staff	2026-08-12 09:23:23.601	2026-08-12 09:23:23.601
\.


--
-- Data for Name: Ticket; Type: TABLE DATA; Schema: public; Owner: ticketing
--

COPY public."Ticket" (id, title, description, priority, status, "employeeId", "technicianId", "departmentId", "categoryId", "createdAt", "updatedAt") FROM stdin;
35	internet	plalalalalalallalallallala	HIGH	RESOLVED	19	4	3	3	2026-08-20 14:19:29.355	2026-08-20 14:25:58.41
5	internet problem	no internet connection	HIGH	CLOSED	7	4	3	3	2026-08-12 11:51:09.876	2026-08-20 14:28:55.865
36	Windows Activation , Office	Office is blocked	HIGH	OPEN	25	4	3	2	2026-08-20 14:31:12.209	2026-08-20 14:33:41.286
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: ticketing
--

COPY public."User" (id, name, email, username, "adSid", role, "departmentId", "createdAt", "updatedAt", "roleLabel") FROM stdin;
8	Sara Nasr	\N	snasr	S-1-5-21-1265877591-1951401560-1917862505-3825	EMPLOYEE	\N	2026-08-12 11:27:12.177	2026-08-12 11:27:12.177	Employee
7	Sharon Kong	\N	skong	S-1-5-21-1265877591-1951401560-1917862505-3072	EMPLOYEE	\N	2026-08-12 11:24:41.18	2026-08-12 11:54:05.595	Academic
19	Sandra Osama	\N	sosama	S-1-5-21-1265877591-1951401560-1917862505-3806	EMPLOYEE	\N	2026-08-20 14:18:50.023	2026-08-20 14:26:27.874	Academic
9	Mohamed Abdelnasser	\N	mabdelnasser	S-1-5-21-1265877591-1951401560-1917862505-3019	TECHNICIAN	\N	2026-08-12 11:28:06.546	2026-08-20 14:31:58.346	IT
25	Myles Mangan	mmagnan@metropolitanschooleg.com	mmangan	S-1-5-21-1265877591-1951401560-1917862505-1133	EMPLOYEE	\N	2026-08-20 14:29:53.993	2026-08-20 14:36:16.918	Academic
4	Mostafa Maher	\N	mmaher	S-1-5-21-1265877591-1951401560-1917862505-3823	TECHNICIAN	\N	2026-08-12 09:45:50.813	2026-10-11 07:27:48.731	IT
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: ticketing
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
118a2bea-ecf6-474c-944b-7aef48026077	8d529a8c1319f318eaecdbfaf27c5ea65ddfbcba3dc31cca0b0e1ed6d38694f3	2026-08-12 09:23:16.49713+00	20260812092316_init	\N	\N	2026-08-12 09:23:16.373119+00	1
9358481c-cee6-4858-82e7-cbd588d733f7	06b0e8ff2f59e2ac769ecd2c33785a63b103846c9b4414417a440ef93d19b970	2026-08-12 11:23:26.4241+00	20260812_role_model_v2	\N	\N	2026-08-12 11:23:26.311309+00	1
d97a5882-469f-4339-978c-46445671d190	611309a7d89040369e11fff46ac5aeccadb3abed6727db79f51e07ef3d1001cc	2026-08-12 11:31:49.643588+00	20260812_role_label_academic	\N	\N	2026-08-12 11:31:49.614628+00	1
\.


--
-- Name: Category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ticketing
--

SELECT pg_catalog.setval('public."Category_id_seq"', 6, true);


--
-- Name: Comment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ticketing
--

SELECT pg_catalog.setval('public."Comment_id_seq"', 10, true);


--
-- Name: Department_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ticketing
--

SELECT pg_catalog.setval('public."Department_id_seq"', 3, true);


--
-- Name: Ticket_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ticketing
--

SELECT pg_catalog.setval('public."Ticket_id_seq"', 36, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: ticketing
--

SELECT pg_catalog.setval('public."User_id_seq"', 30, true);


--
-- Name: Category Category_pkey; Type: CONSTRAINT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."Category"
    ADD CONSTRAINT "Category_pkey" PRIMARY KEY (id);


--
-- Name: Comment Comment_pkey; Type: CONSTRAINT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (id);


--
-- Name: Department Department_pkey; Type: CONSTRAINT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."Department"
    ADD CONSTRAINT "Department_pkey" PRIMARY KEY (id);


--
-- Name: Ticket Ticket_pkey; Type: CONSTRAINT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: Category_name_key; Type: INDEX; Schema: public; Owner: ticketing
--

CREATE UNIQUE INDEX "Category_name_key" ON public."Category" USING btree (name);


--
-- Name: Comment_ticketId_createdAt_idx; Type: INDEX; Schema: public; Owner: ticketing
--

CREATE INDEX "Comment_ticketId_createdAt_idx" ON public."Comment" USING btree ("ticketId", "createdAt");


--
-- Name: Department_name_key; Type: INDEX; Schema: public; Owner: ticketing
--

CREATE UNIQUE INDEX "Department_name_key" ON public."Department" USING btree (name);


--
-- Name: Ticket_categoryId_idx; Type: INDEX; Schema: public; Owner: ticketing
--

CREATE INDEX "Ticket_categoryId_idx" ON public."Ticket" USING btree ("categoryId");


--
-- Name: Ticket_departmentId_idx; Type: INDEX; Schema: public; Owner: ticketing
--

CREATE INDEX "Ticket_departmentId_idx" ON public."Ticket" USING btree ("departmentId");


--
-- Name: Ticket_employeeId_idx; Type: INDEX; Schema: public; Owner: ticketing
--

CREATE INDEX "Ticket_employeeId_idx" ON public."Ticket" USING btree ("employeeId");


--
-- Name: Ticket_status_createdAt_idx; Type: INDEX; Schema: public; Owner: ticketing
--

CREATE INDEX "Ticket_status_createdAt_idx" ON public."Ticket" USING btree (status, "createdAt");


--
-- Name: Ticket_technicianId_idx; Type: INDEX; Schema: public; Owner: ticketing
--

CREATE INDEX "Ticket_technicianId_idx" ON public."Ticket" USING btree ("technicianId");


--
-- Name: User_adSid_key; Type: INDEX; Schema: public; Owner: ticketing
--

CREATE UNIQUE INDEX "User_adSid_key" ON public."User" USING btree ("adSid");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: ticketing
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: ticketing
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- Name: Comment Comment_ticketId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES public."Ticket"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Comment Comment_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Ticket Ticket_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public."Category"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Ticket Ticket_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Ticket Ticket_employeeId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Ticket Ticket_technicianId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."Ticket"
    ADD CONSTRAINT "Ticket_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_departmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ticketing
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES public."Department"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict dIUfk5f4VdHaLkOc9kd6y6PLwoQqofEeEdGVe7hLskAc7IECkhCKFFvXkflIlVD

