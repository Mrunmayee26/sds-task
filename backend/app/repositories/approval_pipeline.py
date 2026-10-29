"""Build campus advisor -> venue manager -> dean stages, plus venue-specific rules."""

from fastapi import HTTPException

TWO_LEVEL_TYPES = {"classroom", "lab", "computer_lab", "drawing_hall", "workshop"}


def groups_for_booking(cur, venue, user_id, advisor_id=None):
    cur.execute(
        "SELECT * FROM approval_groups WHERE group_name='Faculty Advisors Committee'"
    )
    advisor = cur.fetchone()
    groups = []
    if advisor:
        if not advisor["is_active"]:
            raise HTTPException(409, "Faculty advisor group is inactive.")
        if advisor_id is None:
            raise HTTPException(422, "Select a faculty advisor for this booking.")
        cur.execute(
            """SELECT 1 FROM group_members gm JOIN users u USING(user_id)
            WHERE gm.access_id=%s AND gm.user_id=%s AND gm.can_approve AND gm.left_at IS NULL AND u.is_active AND u.user_id<>%s""",
            (advisor["access_id"], advisor_id, user_id),
        )
        if not cur.fetchone():
            raise HTTPException(
                422,
                "Selected faculty advisor is inactive, unassigned, or is the applicant.",
            )
        groups.append({**advisor, "approval_step": 0, "selected_advisor": True})
    elif advisor_id is not None:
        raise HTTPException(422, "Faculty advisor group is not configured.")
    cur.execute(
        "SELECT * FROM approval_groups WHERE access_id=%s", (venue["access_id"],)
    )
    primary = cur.fetchone()
    if not primary or not primary["is_active"]:
        raise HTTPException(409, "Venue approval group is inactive.")
    groups.append({**primary, "approval_step": len(groups)})
    if advisor and venue["venue_type"] not in TWO_LEVEL_TYPES:
        cur.execute(
            "SELECT * FROM approval_groups WHERE group_name='Dean of Student Affairs Office' AND is_active"
        )
        dean = cur.fetchone()
        if not dean:
            raise HTTPException(
                409, "Dean approval group is not configured for this venue."
            )
        groups.append({**dean, "approval_step": len(groups)})
    cur.execute(
        """SELECT g.*,v.approval_step FROM venue_additional_approvals v
        JOIN approval_groups g USING(access_id) WHERE v.venue_id=%s ORDER BY v.approval_step,g.access_id""",
        (venue["venue_id"],),
    )
    base_end = len(groups) - 1
    for extra in cur.fetchall():
        if not extra["is_active"]:
            raise HTTPException(409, "Additional venue approval group is inactive.")
        groups.append({**extra, "approval_step": base_end + extra["approval_step"]})
    # The same committee is requested only once; do not drop additional committees.
    unique = []
    for group in groups:
        if not any(g["access_id"] == group["access_id"] for g in unique):
            unique.append(group)
    return unique
