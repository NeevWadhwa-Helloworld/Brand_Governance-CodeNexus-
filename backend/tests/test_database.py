import unittest

from backend.database import PostgresCursor


class PostgresSqlAdaptationTests(unittest.TestCase):
    def test_escapes_literal_percent_while_converting_placeholders(self):
        statement = "r.text LIKE '%' || t.banned_term || '%' WHERE t.org_id = ?"

        self.assertEqual(
            PostgresCursor._sql(statement),
            "r.text LIKE '%%' || t.banned_term || '%%' WHERE t.org_id = %s",
        )


if __name__ == "__main__":
    unittest.main()
