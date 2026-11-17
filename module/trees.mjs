/** Древа архетипов: строки, развилки и частота способностей. Файл создаёт tools/extract.py. */
export const TREES = {
 "enforcer": {
  "rows": [
   {
    "n": 1,
    "fork": "single",
    "nodes": [
     "1a"
    ]
   },
   {
    "n": 2,
    "fork": "and",
    "nodes": [
     "2a",
     "2b"
    ]
   },
   {
    "n": 3,
    "fork": "single",
    "nodes": [
     "3a"
    ]
   },
   {
    "n": 4,
    "fork": "and",
    "nodes": [
     "4a",
     "4b"
    ]
   },
   {
    "n": 5,
    "fork": "and",
    "nodes": [
     "5a",
     "5b"
    ]
   },
   {
    "n": 6,
    "fork": "single",
    "nodes": [
     "6a"
    ]
   },
   {
    "n": 7,
    "fork": "or",
    "nodes": [
     "7a",
     "7b"
    ]
   },
   {
    "n": 8,
    "fork": "path",
    "nodes": [
     "8a",
     "8b"
    ]
   },
   {
    "n": 9,
    "fork": "path",
    "nodes": [
     "9a",
     "9b"
    ]
   },
   {
    "n": 10,
    "fork": "single",
    "nodes": [
     "10a"
    ]
   }
  ],
  "refresh": {}
 },
 "grifter": {
  "rows": [
   {
    "n": 1,
    "fork": "single",
    "nodes": [
     "1a"
    ]
   },
   {
    "n": 2,
    "fork": "and",
    "nodes": [
     "2a",
     "2b"
    ]
   },
   {
    "n": 3,
    "fork": "single",
    "nodes": [
     "3a"
    ]
   },
   {
    "n": 4,
    "fork": "and",
    "nodes": [
     "4a",
     "4b"
    ]
   },
   {
    "n": 5,
    "fork": "single",
    "nodes": [
     "5a"
    ]
   },
   {
    "n": 6,
    "fork": "and",
    "nodes": [
     "6a",
     "6b"
    ]
   },
   {
    "n": 7,
    "fork": "or",
    "nodes": [
     "7a",
     "7b"
    ]
   },
   {
    "n": 8,
    "fork": "path",
    "nodes": [
     "8a",
     "8b"
    ]
   },
   {
    "n": 9,
    "fork": "path",
    "nodes": [
     "9a",
     "9b"
    ]
   },
   {
    "n": 10,
    "fork": "single",
    "nodes": [
     "10a"
    ]
   }
  ],
  "refresh": {
   "3a": "target",
   "4b": "month",
   "7b": "month",
   "9a": "month"
  }
 },
 "tech": {
  "rows": [
   {
    "n": 1,
    "fork": "and",
    "nodes": [
     "1a",
     "1b"
    ]
   },
   {
    "n": 2,
    "fork": "and",
    "nodes": [
     "2a",
     "2b"
    ]
   },
   {
    "n": 3,
    "fork": "and",
    "nodes": [
     "3a",
     "3b"
    ]
   },
   {
    "n": 4,
    "fork": "and",
    "nodes": [
     "4a",
     "4b"
    ]
   },
   {
    "n": 5,
    "fork": "and",
    "nodes": [
     "5a",
     "5b"
    ]
   },
   {
    "n": 6,
    "fork": "or",
    "nodes": [
     "6a",
     "6b"
    ]
   },
   {
    "n": 7,
    "fork": "path",
    "nodes": [
     "7a",
     "7b"
    ]
   },
   {
    "n": 8,
    "fork": "path",
    "nodes": [
     "8a",
     "8b"
    ]
   },
   {
    "n": 9,
    "fork": "path",
    "nodes": [
     "9a",
     "9b"
    ]
   }
  ],
  "refresh": {
   "6b": "month"
  }
 },
 "media": {
  "rows": [
   {
    "n": 1,
    "fork": "single",
    "nodes": [
     "1a"
    ]
   },
   {
    "n": 2,
    "fork": "and",
    "nodes": [
     "2a",
     "2b"
    ]
   },
   {
    "n": 3,
    "fork": "single",
    "nodes": [
     "3a"
    ]
   },
   {
    "n": 4,
    "fork": "and",
    "nodes": [
     "4a",
     "4b"
    ]
   },
   {
    "n": 5,
    "fork": "single",
    "nodes": [
     "5a"
    ]
   },
   {
    "n": 6,
    "fork": "and",
    "nodes": [
     "6a",
     "6b"
    ]
   },
   {
    "n": 7,
    "fork": "or",
    "nodes": [
     "7a",
     "7b"
    ]
   },
   {
    "n": 8,
    "fork": "path",
    "nodes": [
     "8a",
     "8b"
    ]
   },
   {
    "n": 9,
    "fork": "path",
    "nodes": [
     "9a",
     "9b"
    ]
   },
   {
    "n": 10,
    "fork": "single",
    "nodes": [
     "10a"
    ]
   }
  ],
  "refresh": {
   "1a": "week",
   "2b": "session",
   "4b": "session",
   "6a": "month",
   "7b": "session",
   "9a": "month",
   "9b": "session"
  }
 },
 "lawman": {
  "rows": [
   {
    "n": 1,
    "fork": "single",
    "nodes": [
     "1a"
    ]
   },
   {
    "n": 2,
    "fork": "and",
    "nodes": [
     "2a",
     "2b"
    ]
   },
   {
    "n": 3,
    "fork": "single",
    "nodes": [
     "3a"
    ]
   },
   {
    "n": 4,
    "fork": "and",
    "nodes": [
     "4a",
     "4b"
    ]
   },
   {
    "n": 5,
    "fork": "single",
    "nodes": [
     "5a"
    ]
   },
   {
    "n": 6,
    "fork": "and",
    "nodes": [
     "6a",
     "6b"
    ]
   },
   {
    "n": 7,
    "fork": "or",
    "nodes": [
     "7a",
     "7b"
    ]
   },
   {
    "n": 8,
    "fork": "path",
    "nodes": [
     "8a",
     "8b"
    ]
   },
   {
    "n": 9,
    "fork": "path",
    "nodes": [
     "9a",
     "9b"
    ]
   },
   {
    "n": 10,
    "fork": "path",
    "nodes": [
     "10a",
     "10b"
    ]
   }
  ],
  "refresh": {
   "1a": "trust",
   "3a": "session",
   "4a": "session",
   "6b": "month",
   "8a": "session",
   "10a": "session"
  }
 }
};
