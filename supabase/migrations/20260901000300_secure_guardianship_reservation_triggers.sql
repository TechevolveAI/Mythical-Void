-- Reservation integrity triggers touch private canonical tables while player
-- commands run as authenticated users. Execute only these fixed trigger bodies
-- with owner rights; direct table access remains revoked.

alter function public.assert_committed_guardianship_child_exists()
    security definer;

alter function public.clear_guardianship_child_reservation_on_delete()
    security definer;

