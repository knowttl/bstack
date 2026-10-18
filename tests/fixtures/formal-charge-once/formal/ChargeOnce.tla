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

\* Line 2: store.compareAndSet(orderId, 'pending', 'charging') reads and writes in one atomic step.
Claim(w) ==
    /\ pc[w] = "start"
    /\ IF status = "pending"
       THEN /\ status' = "charging"
            /\ pc' = [pc EXCEPT ![w] = "claimed"]
       ELSE /\ status' = status
            /\ pc' = [pc EXCEPT ![w] = "done"]
    /\ UNCHANGED charges

\* Line 3: gateway.charge(orderId)
Charge(w) ==
    /\ pc[w] = "claimed"
    /\ charges' = charges + 1
    /\ pc' = [pc EXCEPT ![w] = "charged"]
    /\ UNCHANGED status

\* Line 4: store.set(orderId, 'charged')
Finish(w) ==
    /\ pc[w] = "charged"
    /\ status' = "charged"
    /\ pc' = [pc EXCEPT ![w] = "done"]
    /\ UNCHANGED charges

\* Once every worker is done the run ends, so TLC must not report that as a deadlock.
Done ==
    /\ \A w \in Workers : pc[w] = "done"
    /\ UNCHANGED vars

Next == Done \/ \E w \in Workers : Claim(w) \/ Charge(w) \/ Finish(w)

Spec == Init /\ [][Next]_vars

NoDoubleCharge == charges <= 1
====
