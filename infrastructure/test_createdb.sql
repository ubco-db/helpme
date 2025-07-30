CREATE DATABASE chatbot_test; GRANT ALL PRIVILEGES ON DATABASE chatbot_test TO helpme; ALTER DATABASE chatbot_test OWNER TO helpme;
CREATE DATABASE test; GRANT ALL PRIVILEGES ON DATABASE test TO helpme; ALTER DATABASE test OWNER TO helpme;

CREATE TABLE IF NOT EXISTS chatbot_test.public.course_setting
(
    id            UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    "pageContent" TEXT,
    metadata      JSONB,
    embedding     VECTOR
);

CREATE TABLE IF NOT EXISTS chatbot_test.public.document
(
    id            UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    "pageContent" TEXT,
    metadata      JSONB,
    embedding     VECTOR
);

CREATE TABLE IF NOT EXISTS chatbot_test.public.document_aggregate
(
    id            UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    "pageContent" TEXT,
    metadata      JSONB,
    embedding     VECTOR
);

CREATE TABLE IF NOT EXISTS chatbot_test.public.question
(
    id            UUID DEFAULT uuid_generate_v4() NOT NULL PRIMARY KEY,
    "pageContent" TEXT,
    metadata      JSONB,
    embedding     VECTOR
);