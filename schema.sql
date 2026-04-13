CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK (type IN ('suggestion', 'complaint')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'done', 'hold')),
  comment TEXT NOT NULL DEFAULT '',
  likes INTEGER NOT NULL DEFAULT 0,
  deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  is_open INTEGER NOT NULL DEFAULT 1,
  benefit_text TEXT NOT NULL DEFAULT '',
  next_schedule_text TEXT NOT NULL DEFAULT '미정',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS match_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER,
  snapshot_key TEXT NOT NULL UNIQUE,
  match_date TEXT NOT NULL,             -- YYYY-MM-DD
  match_date_text TEXT NOT NULL,        -- 04.11 같은 표시용
  title TEXT NOT NULL DEFAULT '최근 내전 결과',
  summary_text TEXT NOT NULL,
  winner_team TEXT,
  winner_score REAL,
  winner_members_json TEXT NOT NULL DEFAULT '[]',
  mvp_name TEXT,
  mvp_score REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (round_id) REFERENCES rounds(id)
);

CREATE INDEX IF NOT EXISTS idx_match_results_match_date
ON match_results(match_date DESC);

CREATE INDEX IF NOT EXISTS idx_match_results_round_id
ON match_results(round_id);

CREATE TABLE IF NOT EXISTS match_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  result_id INTEGER NOT NULL,
  row_no INTEGER NOT NULL,
  col1 TEXT DEFAULT '',
  col2 TEXT DEFAULT '',
  col3 TEXT DEFAULT '',
  col4 TEXT DEFAULT '',
  col5 TEXT DEFAULT '',
  FOREIGN KEY (result_id) REFERENCES match_results(id) ON DELETE CASCADE,
  UNIQUE(result_id, row_no)
);

CREATE INDEX IF NOT EXISTS idx_match_rows_result_id
ON match_rows(result_id);

