import { useState } from "react";
import Collapsible from "react-collapsible";

import { vestingSessionType } from "../types/types";

import "./SessionCard.css";
import { fromMAS } from "@massalabs/massa-web3";
import { formatAddress, fromnMAS, msToTime } from "../utils";

import { ReactComponent as MassaWalletIcon } from "../assets/massa_wallet.svg";
import { ReactComponent as BearbyWalletIcon } from "../assets/bearby_wallet.svg";

type Props = {
  vestingSession: vestingSessionType;
  accountName?: string;
  accountProvider?: "MASSASTATION" | "BEARBY";
};

function VestingSessionCard({
  vestingSession,
  accountName,
  accountProvider,
}: Props) {
  const [amountToClaim, setAmountToClaim] = useState("");
  const { vestingInfo, availableAmount, claimedAmount } = vestingSession;

  if (!vestingInfo) return null;

  const {
    toAddr,
    startTimestamp,
    linearDuration,
    cliffDuration,
    initialReleaseAmount,
    tag,
  } = vestingInfo;

  const handleClaim = () => {
    // handle claim logic here
  };

  return (
    <div className="vesting-session-card">
      <div className="header">
        <div>
          {accountProvider === "BEARBY" ? (
            <BearbyWalletIcon className="avatar" />
          ) : accountProvider === "MASSASTATION" ? (
            <MassaWalletIcon className="avatar" />
          ) : null}
          <strong>
            {accountName ? accountName : "Account"} -{" "}
            {formatAddress(toAddr.base58Encode)}
          </strong>
        </div>
        <span className="tag">{tag}</span>
      </div>
      <div className="total-amount">
        Total amount: {fromnMAS(vestingInfo.totalAmount)}
      </div>
      <div className="claimable-amount">
        Available to Claim: {fromnMAS(availableAmount)}
      </div>
      <div className="input-container">
        <input
          type="text"
          value={amountToClaim}
          onChange={(e) => setAmountToClaim(e.target.value)}
          onBlur={(e) => {
            if (e.target.value === "") return;
            try {
              const isValid = fromMAS(e.target.value);
              if (isValid < BigInt(0)) {
                alert("Please enter a positive number");
              }
              if (isValid === BigInt(0)) {
                alert("Please enter a non-zero number");
              }
            } catch (e) {
              if (e instanceof Error) {
                alert(`Please enter a valid MAS value: ${e.message}`);
              }
            }
          }}
        />
        <button onClick={handleClaim}>Claim</button>
      </div>
      <hr />
      <Collapsible trigger="More infos">
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>Start Date:</div>
          <div style={{ fontWeight: "bold" }}>
            {new Date(Number(startTimestamp)).toLocaleDateString("en-US")}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>Initial Release:</div>
          <div style={{ fontWeight: "bold" }}>
            {fromnMAS(initialReleaseAmount)}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>Cliff Duration:</div>
          <div style={{ fontWeight: "bold" }}>
            {msToTime(Number(cliffDuration))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>Linear Duration:</div>
          <div style={{ fontWeight: "bold" }}>
            {msToTime(Number(linearDuration))}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>Claimed:</div>
          <div style={{ fontWeight: "bold" }}>{fromnMAS(claimedAmount)}</div>
        </div>
      </Collapsible>
    </div>
  );
}

export default VestingSessionCard;
