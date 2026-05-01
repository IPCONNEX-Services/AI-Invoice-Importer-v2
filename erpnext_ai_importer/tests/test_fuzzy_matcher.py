import pytest
from erpnext_ai_importer.utils.fuzzy_matcher import (
    _fuzzy_match_from_choices,
    _fuzzy_top_matches_from_choices,
)


def test_exact_match():
    choices = {"BELL-001": "Bell Canada", "COG-001": "Cogeco"}
    result, score = _fuzzy_match_from_choices("Bell Canada", choices)
    assert result == "BELL-001"
    assert score >= 95


def test_partial_name_match():
    choices = {"BELL-001": "Bell Canada", "COG-001": "Cogeco"}
    result, score = _fuzzy_match_from_choices("Bell Canada Inc.", choices)
    assert result == "BELL-001"
    assert score >= 70


def test_no_match_returns_none():
    choices = {"BELL-001": "Bell Canada"}
    result, score = _fuzzy_match_from_choices("Completely Unknown Corp", choices, threshold=95)
    assert result is None
    assert score == 0


def test_top_matches_returns_sorted():
    choices = {
        "BELL-001": "Bell Canada",
        "BELL-002": "Bell Mobility",
        "COG-001": "Cogeco",
    }
    matches = _fuzzy_top_matches_from_choices("Bell", choices, limit=5, threshold=30)
    assert len(matches) >= 2
    assert matches[0]["score"] >= matches[1]["score"]
    assert all("Bell" in m["display_name"] for m in matches[:2])


def test_empty_name_returns_none():
    choices = {"BELL-001": "Bell Canada"}
    result, score = _fuzzy_match_from_choices("", choices)
    assert result is None
    assert score == 0
