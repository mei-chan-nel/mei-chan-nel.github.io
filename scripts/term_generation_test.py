"""Term data generation uses only public article content and current question tags."""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import generate_term_guides as generator


class TermGenerationTest(unittest.TestCase):
    def page(self, title="Alpha", body="<h2>Heading</h2><p>Explanation <strong>body</strong>.</p>"):
        return f'''<html><head><meta name="study-atlas-term-tag" content="Alpha" />
        <link href="../../assets/term-page.css?v=1" /></head><body>
        <nav>navigation-secret</nav><h1 id="term-heading">{title}</h1>
        <div id="term-explanation">{body}</div>
        <ol class="choice-list"><li>choice-secret</li></ol>
        <div data-manual-ad>advert-secret</div></body></html>'''

    def test_explanation_scope(self):
        parser = generator.ExplanationParser()
        parser.feed(self.page(body='<h2>Heading</h2><p>A<span>Ｂ</span> body<br/>tail</p><nav>nav-secret</nav><script>script-secret</script><div class="choice-list">choice-secret</div><div data-manual-ad>ad-secret</div>'))
        self.assertEqual("".join(parser.title), "Alpha")
        text = " ".join("".join(parser.body).split())
        self.assertIn("Heading", text)
        self.assertIn("AＢ body tail", text)
        self.assertNotIn("secret", text)

    def test_features_idempotent_and_new_pages_supported(self):
        first = generator.enhance_term_page(self.page())
        self.assertEqual(first, generator.enhance_term_page(first))
        self.assertEqual(first.count('data-term-page-state'), 1)
        self.assertEqual(first.count('assets/term-state.js'), 1)
        self.assertEqual(first.count('assets/term-reader.js'), 1)
        self.assertIn('data-term-favorite', first)
        self.assertIn(f'term-page.css?v={generator.FEATURE_VERSION}', first)
        with self.assertRaises(ValueError):
            generator.enhance_term_page('<html>missing body/heading</html>')

    def test_add_update_and_multiple_question_tags(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            terms = root / 'terms'
            for slug, tag in [('alpha', 'Alpha'), ('beta', 'Beta')]:
                path = terms / slug / 'index.html'
                path.parent.mkdir(parents=True)
                path.write_text(self.page(tag).replace('content="Alpha"', f'content="{tag}"'), encoding='utf-8')
            with patch.object(generator, 'TERMS_ROOT', terms):
                pages = generator.scan_term_pages()
            data = generator.build_search_data(pages)
            self.assertEqual(set(data), {'Alpha', 'Beta'})
            self.assertNotIn('choice-secret', data['Alpha']['body'])
            pages[0].path.write_text(self.page(body='<p>Updated explanation</p>'), encoding='utf-8')
            self.assertEqual(generator.build_search_data(pages)['Alpha']['body'], 'Updated explanation')
            questions = root / 'data/questions/completed_questions.json'
            questions.parent.mkdir(parents=True)
            questions.write_text(json.dumps([{'id':'q1', 'tags':['Alpha', 'Beta', 'Alpha', 'unpublished']}, {'id':'q2', 'tags':['unpublished']}]), encoding='utf-8')
            self.assertEqual(generator.build_question_tags(root, pages), {'q1':['Alpha', 'Beta']})
            index = generator.render_term_list(['Beta', 'unpublished', 'Alpha'], pages)
            self.assertLess(index.index('href="./beta/"'), index.index('href="./alpha/"'))
            self.assertNotIn('href="./unpublished/"', index)


if __name__ == '__main__':
    unittest.main()
