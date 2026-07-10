"""
Document search engine with full-text indexing.
"""
from collections import defaultdict
from src.models.user import Document, SearchQuery


class SearchEngine:
    """Simple inverted-index search engine for documents."""

    def __init__(self):
        self._index: dict[str, set[str]] = defaultdict(set)

    def index_document(self, doc: Document):
        """Index a document by its content keywords."""
        words = set(doc.content.lower().split())
        for word in words:
            self._index[word].add(doc.id)

    def search(self, query: SearchQuery) -> list[str]:
        """Search for documents matching the query keywords."""
        if not query.keywords:
            return []

        result_sets = []
        for kw in query.keywords:
            result_sets.append(self._index.get(kw.lower(), set()))

        if not result_sets:
            return []

        matched_ids = result_sets[0].intersection(*result_sets[1:])
        result = list(matched_ids)

        offset = query.offset or 0
        limit = query.limit or 20
        return result[offset: offset + limit]
