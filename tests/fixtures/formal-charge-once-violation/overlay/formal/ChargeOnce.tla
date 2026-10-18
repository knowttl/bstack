---- MODULE ChargeOnce ----
\* Models src/charge.mjs: each action is one atomic step of the code, and the comment names its line.
EXTENDS Naturals

CONSTANT Workers

VARIABLES status, pc, charges
vars == <<status, pc, charges>>

Init ==
    /\ status = "pending"
    /\ pc = [w \in Workers |-> "start"]
    /\ charges = 0

\* Line 2: store.get(orderId) !== 'pending' only reads, so another worker can claim before this one writes.
Read(w) ==
    /\ pc[w] = "start"
    /\ pc' = [pc EXCEPT ![w] = IF status = "pending" THEN "read" ELSE "done"]
    /\ UNCHANGED <<status, charges>>

\* Line 3: store.set(orderId, 'charging')
Claim(w) ==
    /\ pc[w] = "read"
    /\ status' = "charging"
    /\ pc' = [pc EXCEPT ![w] = "claimed"]
    /\ UNCHANGED charges

\* Line 4: gateway.charge(orderId)
Charge(w) ==
    /\ pc[w] = "claimed"
    /\ charges' = charges + 1
    /\ pc' = [pc EXCEPT ![w] = "charged"]
    /\ UNCHANGED status

\* Line 5: store.set(orderId, 'charged')
Finish(w) ==
    /\ pc[w] = "charged"
    /\ status' = "charged"
    /\ pc' = [pc EXCEPT ![w] = "done"]
    /\ UNCHANGED charges

\* Once every worker is done the run ends, so TLC must not report that as a deadlock.
Done ==
    /\ \A w \in Workers : pc[w] = "done"
    /\ UNCHANGED vars

Next == Done \/ \E w \in Workers : Read(w) \/ Claim(w) \/ Charge(w) \/ Finish(w)

Spec == Init /\ [][Next]_vars

NoDoubleCharge == charges <= 1
====
