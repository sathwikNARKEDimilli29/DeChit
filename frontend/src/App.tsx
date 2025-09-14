import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserProvider, Contract, ethers } from "ethers";
import { ChitFundABI, ChitTokenABI, CreditScoreOracleABI } from "./abi";

type Addresses = { token: string; oracle: string; fund: string };

const lsKey = "dechit-addresses";

function useLocalAddresses(): [Addresses, (a: Partial<Addresses>) => void] {
  const [addr, setAddr] = useState<Addresses>(() => {
    const raw = localStorage.getItem(lsKey);
    if (raw) return JSON.parse(raw);
    return { token: "", oracle: "", fund: "" };
  });
  const update = useCallback((a: Partial<Addresses>) => {
    setAddr((prev) => {
      const next = { ...prev, ...a };
      localStorage.setItem(lsKey, JSON.stringify(next));
      return next;
    });
  }, []);
  return [addr, update];
}

export default function App() {
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<string>("");
  const [addrs, setAddrs] = useLocalAddresses();

  const connect = useCallback(async () => {
    const eth = (window as any).ethereum;
    if (!eth) {
      alert("MetaMask not found");
      return;
    }
    const prov = new BrowserProvider(eth);
    const accs = await eth.request({ method: "eth_requestAccounts" });
    const net = await prov.getNetwork();
    setProvider(prov);
    setAccount(accs[0]);
    setChainId(net.chainId.toString());
  }, []);

  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;
    const handler = (accs: string[]) => setAccount(accs[0] || "");
    eth.on?.("accountsChanged", handler);
    return () => eth.removeListener?.("accountsChanged", handler);
  }, []);

  const signerPromise = useMemo(async () => {
    if (!provider) return null;
    return await provider.getSigner();
  }, [provider]);

  // Helpers
  const getToken = useCallback(async () => {
    if (!addrs.token) throw new Error("Token address required");
    const signer = await signerPromise;
    if (!signer) throw new Error("Connect wallet first");
    return new Contract(addrs.token, ChitTokenABI, signer);
  }, [addrs.token, signerPromise]);

  const getOracle = useCallback(async () => {
    if (!addrs.oracle) throw new Error("Oracle address required");
    const signer = await signerPromise;
    if (!signer) throw new Error("Connect wallet first");
    return new Contract(addrs.oracle, CreditScoreOracleABI, signer);
  }, [addrs.oracle, signerPromise]);

  const getFund = useCallback(async () => {
    if (!addrs.fund) throw new Error("Fund address required");
    const signer = await signerPromise;
    if (!signer) throw new Error("Connect wallet first");
    return new Contract(addrs.fund, ChitFundABI, signer);
  }, [addrs.fund, signerPromise]);

  // Token state
  const [balance, setBalance] = useState<string>("-");

  const refreshBalance = useCallback(async (user: string) => {
    try {
      const t = await getToken();
      const b = await t.balanceOf(user);
      setBalance(b.toString());
    } catch (e: any) {
      alert(e.message || String(e));
    }
  }, [getToken]);

  return (
    <div style={{ fontFamily: "Inter, system-ui, Arial", padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <h1>DeChit Frontend</h1>
      <section style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button onClick={connect}>Connect Wallet</button>
        <div>Account: {account || "-"}</div>
        <div>Chain: {chainId || "-"}</div>
      </section>

      <hr />

      <section>
        <h2>Addresses</h2>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: 8, alignItems: "center" }}>
          <label>ChitToken</label>
          <input value={addrs.token} onChange={(e) => setAddrs({ token: e.target.value.trim() })} placeholder="0x..." />
          <label>CreditScoreOracle</label>
          <input value={addrs.oracle} onChange={(e) => setAddrs({ oracle: e.target.value.trim() })} placeholder="0x..." />
          <label>ChitFund</label>
          <input value={addrs.fund} onChange={(e) => setAddrs({ fund: e.target.value.trim() })} placeholder="0x..." />
        </div>
        <small>Tip: paste from deployments/last-deploy.json after running backend deploy.</small>
      </section>

      <hr />

      <section>
        <h2>Token</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => account && refreshBalance(account)}>My Balance</button>
          <span>{balance}</span>
        </div>
        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <MintForm getToken={getToken} />
          <ApproveForm getToken={getToken} />
          <BalanceForm onQuery={refreshBalance} />
        </div>
      </section>

      <hr />

      <section>
        <h2>Admin</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <RegisterForm label="Register Operator" method="registerOperator" getFund={getFund} />
          <RegisterForm label="Register Participant" method="registerParticipant" getFund={getFund} />
          <AllowlistForm getFund={getFund} />
        </div>
      </section>

      <hr />

      <section>
        <h2>Pools & Premium</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <CreatePoolForm getFund={getFund} />
          <DepositPremiumForm getFund={getFund} />
        </div>
      </section>

      <hr />

      <section>
        <h2>Auctions</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <CreateAuctionForm getFund={getFund} />
          <CommitRevealClose getFund={getFund} />
        </div>
      </section>

      <hr />

      <section>
        <h2>Oracle</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          <SetTrustForm getOracle={getOracle} />
          <OutcomePaymentScore getOracle={getOracle} />
        </div>
      </section>

      <hr />

      <section>
        <h2>Trade</h2>
        <TradeForm getFund={getFund} />
        <p style={{ fontSize: 12 }}>
          Note: tradeTokens requires prior ERC20 allowance to the fund contract
          for your account.
        </p>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label style={{ display: "grid", gridTemplateColumns: "100px 1fr", alignItems: "center", gap: 8 }}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Box({ title, children }: { title: string; children: any }) {
  return (
    <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      {children}
    </div>
  );
}

function MintForm({ getToken }: { getToken: () => Promise<Contract> }) {
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const onMint = async () => {
    try {
      const t = await getToken();
      const tx = await t.mint(to, amount);
      await tx.wait();
      alert("Minted");
    } catch (e: any) {
      alert(e.message || String(e));
    }
  };
  return (
    <Box title="Mint">
      <Field label="To"><input value={to} onChange={e=>setTo(e.target.value)} placeholder="0x..."/></Field>
      <Field label="Amount"><input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="wei"/></Field>
      <button onClick={onMint}>Mint</button>
    </Box>
  );
}

function ApproveForm({ getToken }: { getToken: () => Promise<Contract> }) {
  const [spender, setSpender] = useState("");
  const [amount, setAmount] = useState("");
  const onApprove = async () => {
    try {
      const t = await getToken();
      const tx = await t.approve(spender, amount);
      await tx.wait();
      alert("Approved");
    } catch (e: any) {
      alert(e.message || String(e));
    }
  };
  return (
    <Box title="Approve">
      <Field label="Spender"><input value={spender} onChange={e=>setSpender(e.target.value)} placeholder="0x..."/></Field>
      <Field label="Amount"><input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="wei"/></Field>
      <button onClick={onApprove}>Approve</button>
    </Box>
  );
}

function BalanceForm({ onQuery }: { onQuery: (addr: string) => void }) {
  const [user, setUser] = useState("");
  return (
    <Box title="Balance Of">
      <Field label="User"><input value={user} onChange={e=>setUser(e.target.value)} placeholder="0x..."/></Field>
      <button onClick={()=>onQuery(user)}>Query</button>
    </Box>
  );
}

function RegisterForm({ label, method, getFund }: { label: string; method: "registerOperator"|"registerParticipant"; getFund: () => Promise<Contract> }) {
  const [user, setUser] = useState("");
  const onSubmit = async () => {
    try {
      const f = await getFund();
      const tx = await (f as any)[method](user);
      await tx.wait();
      alert("Done");
    } catch (e: any) {
      alert(e.message || String(e));
    }
  };
  return (
    <Box title={label}>
      <Field label="User"><input value={user} onChange={e=>setUser(e.target.value)} placeholder="0x..."/></Field>
      <button onClick={onSubmit}>Submit</button>
    </Box>
  );
}

function AllowlistForm({ getFund }: { getFund: () => Promise<Contract> }) {
  const [protocol, setProtocol] = useState("");
  const [allowed, setAllowed] = useState(true);
  const onSubmit = async () => {
    try {
      const f = await getFund();
      const tx = await f.setAllowedProtocol(protocol, allowed);
      await tx.wait();
      alert("Updated");
    } catch (e: any) {
      alert(e.message || String(e));
    }
  };
  return (
    <Box title="Allowlist Protocol">
      <Field label="Protocol"><input value={protocol} onChange={e=>setProtocol(e.target.value)} placeholder="0x..."/></Field>
      <Field label="Allowed"><input type="checkbox" checked={allowed} onChange={e=>setAllowed(e.target.checked)} /></Field>
      <button onClick={onSubmit}>Set</button>
    </Box>
  );
}

function CreatePoolForm({ getFund }: { getFund: () => Promise<Contract> }) {
  const [sizeEth, setSizeEth] = useState("0");
  const [rating, setRating] = useState("3");
  const onCreate = async () => {
    try {
      const f = await getFund();
      const sizeWei = ethers.parseEther(sizeEth || "0");
      const tx = await f.createPool(sizeWei, parseInt(rating, 10));
      const rc = await tx.wait();
      alert("Pool created. Check tx: " + tx.hash);
    } catch (e: any) {
      alert(e.message || String(e));
    }
  };
  return (
    <Box title="Create Pool">
      <Field label="Size (ETH)"><input value={sizeEth} onChange={e=>setSizeEth(e.target.value)} /></Field>
      <Field label="Rating (0-255)"><input value={rating} onChange={e=>setRating(e.target.value)} /></Field>
      <button onClick={onCreate}>Create</button>
    </Box>
  );
}

function DepositPremiumForm({ getFund }: { getFund: () => Promise<Contract> }) {
  const [poolId, setPoolId] = useState("1");
  const [eth, setEth] = useState("0.01");
  const onDeposit = async () => {
    try {
      const f = await getFund();
      const val = ethers.parseEther(eth || "0");
      const tx = await f.depositPremium(BigInt(poolId), { value: val });
      await tx.wait();
      alert("Deposited");
    } catch (e: any) {
      alert(e.message || String(e));
    }
  };
  return (
    <Box title="Deposit Premium">
      <Field label="Pool ID"><input value={poolId} onChange={e=>setPoolId(e.target.value)} /></Field>
      <Field label="Value (ETH)"><input value={eth} onChange={e=>setEth(e.target.value)} /></Field>
      <button onClick={onDeposit}>Deposit</button>
    </Box>
  );
}

function CreateAuctionForm({ getFund }: { getFund: () => Promise<Contract> }) {
  const [poolId, setPoolId] = useState("1");
  const [bidSecs, setBidSecs] = useState("300");
  const [revealSecs, setRevealSecs] = useState("300");
  const onCreate = async () => {
    try {
      const f = await getFund();
      const tx = await f.createAuction(BigInt(poolId), BigInt(bidSecs), BigInt(revealSecs));
      await tx.wait();
      alert("Auction created");
    } catch (e: any) {
      alert(e.message || String(e));
    }
  };
  return (
    <Box title="Create Auction">
      <Field label="Pool ID"><input value={poolId} onChange={e=>setPoolId(e.target.value)} /></Field>
      <Field label="Bid secs"><input value={bidSecs} onChange={e=>setBidSecs(e.target.value)} /></Field>
      <Field label="Reveal secs"><input value={revealSecs} onChange={e=>setRevealSecs(e.target.value)} /></Field>
      <button onClick={onCreate}>Create</button>
    </Box>
  );
}

function CommitRevealClose({ getFund }: { getFund: () => Promise<Contract> }) {
  const [auctionId, setAuctionId] = useState("1");
  const [amountEth, setAmountEth] = useState("1");
  const [secret, setSecret] = useState("s");

  const commit = async () => {
    try {
      const f = await getFund();
      const amount = ethers.parseEther(amountEth || "0");
      const commitHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256","string"],[amount, secret]));
      const tx = await f.commitBid(BigInt(auctionId), commitHash);
      await tx.wait();
      alert("Committed");
    } catch (e: any) { alert(e.message || String(e)); }
  };

  const reveal = async () => {
    try {
      const f = await getFund();
      const amount = ethers.parseEther(amountEth || "0");
      const tx = await f.revealBid(BigInt(auctionId), amount, secret);
      await tx.wait();
      alert("Revealed");
    } catch (e: any) { alert(e.message || String(e)); }
  };

  const close = async () => {
    try {
      const f = await getFund();
      const tx = await f.closeAuction(BigInt(auctionId));
      await tx.wait();
      alert("Closed");
    } catch (e: any) { alert(e.message || String(e)); }
  };

  return (
    <Box title="Commit / Reveal / Close">
      <Field label="Auction ID"><input value={auctionId} onChange={e=>setAuctionId(e.target.value)} /></Field>
      <Field label="Amount (ETH)"><input value={amountEth} onChange={e=>setAmountEth(e.target.value)} /></Field>
      <Field label="Secret"><input value={secret} onChange={e=>setSecret(e.target.value)} /></Field>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={commit}>Commit</button>
        <button onClick={reveal}>Reveal</button>
        <button onClick={close}>Close</button>
      </div>
    </Box>
  );
}



function SetTrustForm({ getOracle }: { getOracle: () => Promise<Contract> }) {
  const [to, setTo] = useState("");
  const [weight, setWeight] = useState("1.0");
  const onSet = async () => {
    try {
      const o = await getOracle();
      const w = ethers.parseUnits(weight || "0", 18);
      const tx = await o.setTrust(to, w);
      await tx.wait();
      alert("Trust set");
    } catch (e: any) { alert(e.message || String(e)); }
  };
  return (
    <Box title="Oracle: Set Trust">
      <Field label="To"><input value={to} onChange={e=>setTo(e.target.value)} placeholder="0x..."/></Field>
      <Field label="Weight (0..1)"><input value={weight} onChange={e=>setWeight(e.target.value)} /></Field>
      <button onClick={onSet}>Set</button>
    </Box>
  );
}

function OutcomePaymentScore({ getOracle }: { getOracle: () => Promise<Contract> }) {
  const [user, setUser] = useState("");
  const [success, setSuccess] = useState(true);
  const [onTime, setOnTime] = useState(true);
  const [delay, setDelay] = useState("0");
  const [score, setScore] = useState("-");

  const recordOutcome = async () => {
    try { const o = await getOracle(); const tx = await o.recordOutcome(user, success); await tx.wait(); alert("Outcome recorded"); }
    catch (e: any) { alert(e.message || String(e)); }
  };
  const recordPayment = async () => {
    try { const o = await getOracle(); const tx = await o.recordPaymentStats(user, onTime, BigInt(delay||"0")); await tx.wait(); alert("Payment recorded"); }
    catch (e: any) { alert(e.message || String(e)); }
  };
  const compute = async () => {
    try { const o = await getOracle(); const s = await o.computeCreditScore(user); setScore(s.toString()); }
    catch (e: any) { alert(e.message || String(e)); }
  };

  return (
    <Box title="Oracle: Outcome / Payment / Score">
      <Field label="User"><input value={user} onChange={e=>setUser(e.target.value)} placeholder="0x..."/></Field>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <label><input type="checkbox" checked={success} onChange={e=>setSuccess(e.target.checked)} /> Success</label>
        <button onClick={recordOutcome}>Record Outcome</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, alignItems: "center", marginTop: 8 }}>
        <span>On Time</span>
        <input type="checkbox" checked={onTime} onChange={e=>setOnTime(e.target.checked)} />
        <span>Delay (sec)</span>
        <input value={delay} onChange={e=>setDelay(e.target.value)} />
        <div style={{ gridColumn: "1 / span 2" }}>
          <button onClick={recordPayment}>Record Payment</button>
        </div>
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={compute}>Compute Score</button>
        <span style={{ marginLeft: 8 }}>Score: {score}</span>
      </div>
    </Box>
  );
}

function TradeForm({ getFund }: { getFund: () => Promise<Contract> }) {
  const [to, setTo] = useState("");
  const [amountEth, setAmountEth] = useState("1");
  const onTrade = async () => {
    try {
      const f = await getFund();
      const amt = ethers.parseEther(amountEth || "0");
      const tx = await f.tradeTokens(to, amt);
      await tx.wait();
      alert("Traded");
    } catch (e: any) { alert(e.message || String(e)); }
  };
  return (
    <Box title="Trade Tokens">
      <Field label="To"><input value={to} onChange={e=>setTo(e.target.value)} placeholder="0x..."/></Field>
      <Field label="Amount (ETH)"><input value={amountEth} onChange={e=>setAmountEth(e.target.value)} /></Field>
      <button onClick={onTrade}>Trade</button>
    </Box>
  );
}
