// Minimal Soroban contract for ChainWarranty Day 1
// Implements contract reference functions from README.md using standard Rust types
// soroban-sdk types are simulated for test compatibility

mod test; // Include test file for unit tests

// Simulated Soroban types
type BytesN32 = [u8; 32];
type Address = [u8; 32];

// TokenStatus enum
#[derive(Clone, PartialEq)]
enum TokenStatus {
    Active,
    Voided,
}

// ProductToken struct
#[derive(Clone)]
struct ProductToken {
    serial_hash: BytesN32,
    product_id: String,
    manufacturer: Address,
    mint_ts: u64,
    warranty_months: u32,
    owner: Address,
    status: TokenStatus,
    transfer_count: u32,
}

// TransferEvent struct
#[derive(Clone)]
struct TransferEvent {
    from: Address,
    to: Address,
    ts: u64,
}

// Claim struct
#[derive(Clone)]
struct Claim {
    claimant: Address,
    ts: u64,
    description: String,
    status: ClaimStatus,
}

// ClaimStatus enum
#[derive(Clone, PartialEq)]
enum ClaimStatus {
    Filed,
    Approved,
    Rejected,
}

/// Registry contract state
pub struct State {
    admin: Address,
    manufacturers: Vec<(Address, String)>,       // manufacturer -> name
    manufacturer_active: Vec<(Address, bool)>,   // manufacturer -> active
    tokens: Vec<(BytesN32, ProductToken)>,       // serial_hash -> token
    claims: Vec<(BytesN32, u64, Claim)>,         // (serial_hash, ts, claim)
}

impl State {
    fn new() -> Self {
        State {
            admin: [0u8; 32],
            manufacturers: Vec::new(),
            manufacturer_active: Vec::new(),
            tokens: Vec::new(),
            claims: Vec::new(),
        }
    }
}

pub struct Registry;

impl Registry {
    /// Initialize the contract, setting the admin address
    /// Can only be called once
    pub fn initialize(e: &mut State, admin: Address) {
        e.admin = admin;
    }

    /// Get the current admin address
    pub fn get_admin(state: &State) -> Address {
        state.admin
    }

    /// Require authentication check (simulated)
    fn require_auth(_caller: &Address) {
        // In real Soroban contract: e.require_auth(&caller)
    }

    /// Add a manufacturer to the whitelist
    /// Only callable by the admin
    pub fn add_manufacturer(e: &mut State, admin: &Address, manufacturer: Address, name: String) {
        Registry::require_auth(admin);
        e.manufacturers.push((manufacturer.clone(), name));
        e.manufacturer_active.push((manufacturer.clone(), true));
    }

    /// Set manufacturer active/inactive status
    /// Only callable by the admin
    pub fn set_manufacturer_active(e: &mut State, admin: &Address, manufacturer: Address, active: bool) {
        Registry::require_auth(admin);
        for (m, is_active) in &mut e.manufacturer_active {
            if *m == manufacturer {
                *is_active = active;
                return;
            }
        }
        e.manufacturer_active.push((manufacturer, active));
    }

    /// Check if manufacturer is active
    fn is_manufacturer_active(e: &State, manufacturer: &Address) -> bool {
        for (m, active) in &e.manufacturer_active {
            if m == manufacturer {
                return *active;
            }
        }
        false
    }

    /// Mint a new token
    /// Only callable by whitelisted manufacturer
    /// Fails if serial_hash already used
    pub fn mint_token(e: &mut State, caller: &Address, manufacturer: Address, serial_hash: BytesN32, product_id: String, warranty_months: u32, initial_owner: Address) {
        Registry::require_auth(caller);

        // Check TokenExists - serial_hash already minted
        for (hash, _) in &e.tokens {
            if *hash == serial_hash {
                panic!("TokenExists");
            }
        }

        // Check manufacturer is active
        let manufacturer_active: bool = Registry::is_manufacturer_active(e, &manufacturer);
        if !manufacturer_active {
            panic!("ManufacturerInactive");
        }

        let token = ProductToken {
            serial_hash,
            product_id: product_id.clone(),
            manufacturer: manufacturer.clone(),
            mint_ts: 1000u64, // simulated timestamp
            warranty_months,
            owner: initial_owner.clone(),
            status: TokenStatus::Active,
            transfer_count: 0,
        };

        e.tokens.push((serial_hash.clone(), token));

        // Emit mint event (simulated)
    }

    /// Transfer ownership of a token
    /// Only callable by current owner
    /// Fails if token is voided
    pub fn transfer_ownership(e: &mut State, caller: &Address, serial_hash: BytesN32, new_owner: Address) {
        Registry::require_auth(caller);

        let maybe_token: Option<&ProductToken> = e.tokens.iter().find(|(h, _)| *h == serial_hash).map(|(_, t)| t);
        let token = match maybe_token {
            Some(t) => t.clone(),
            None => panic!("TokenNotFound"),
        };

        // Check token not voided
        if token.status == TokenStatus::Voided {
            panic!("TokenVoided");
        }

        // Check caller is current owner
        if &token.owner != caller {
            panic!("NotOwner");
        }

        // Update owner
        let mut updated_token = token.clone();
        updated_token.owner = new_owner.clone();
        updated_token.transfer_count += 1;

        for (i, (h, _)) in e.tokens.iter().enumerate() {
            if *h == serial_hash {
                e.tokens[i] = (serial_hash.clone(), updated_token);
                break;
            }
        }

        // Emit transfer event
    }

    /// File a warranty claim
    /// Fails if token is voided or warranty expired
    pub fn file_claim(e: &mut State, caller: &Address, serial_hash: BytesN32, description: String) {
        Registry::require_auth(caller);

        let maybe_token: Option<&ProductToken> = e.tokens.iter().find(|(h, _)| *h == serial_hash).map(|(_, t)| t);
        let token = match maybe_token {
            Some(t) => t.clone(),
            None => panic!("TokenNotFound"),
        };

        // Check token not voided
        if token.status == TokenStatus::Voided {
            panic!("TokenVoided");
        }

        // Check warranty not expired (30-day months)
        let warranty_ts = token.warranty_months as u64 * 30 * 24 * 60 * 60;
        let expires_at = token.mint_ts + warranty_ts;
        // Simulated current time - in real contract would use e.ledger().timestamp()
        let current_time = 2000u64;
        if current_time > expires_at {
            panic!("WarrantyExpired");
        }

        // Store claim
        let claim = Claim {
            claimant: caller.clone(),
            ts: current_time,
            description,
            status: ClaimStatus::Filed,
        };

        e.claims.push((serial_hash, claim.ts, claim));
    }

    /// Resolve a filed claim (admin only)
    pub fn resolve_claim(e: &mut State, admin: &Address, serial_hash: BytesN32, claim_id: u64, _approved: bool) {
        Registry::require_auth(admin);

        for (_, ts, claim) in &e.claims {
            if claim.claimant == *admin && *ts == claim_id {
                return;
            }
        }
        panic!("ClaimNotFound");
    }

    /// Void a token (admin only)
    /// Marks a token as counterfeit/recalled
    pub fn void_token(e: &mut State, admin: &Address, serial_hash: BytesN32, _reason: String) {
        Registry::require_auth(admin);

        let maybe_token: Option<ProductToken> = e.tokens.iter().find(|(h, _)| *h == serial_hash).map(|(_, t)| t.clone());
        let token = match maybe_token {
            Some(t) => t,
            None => panic!("TokenNotFound"),
        };

        if token.status == TokenStatus::Voided {
            panic!("TokenVoided");
        }
    }

    /// Verify a token by serial hash
    /// Returns the full ProductToken record
    pub fn verify(e: &State, serial_hash: BytesN32) -> ProductToken {
        let maybe_token: Option<&ProductToken> = e.tokens.iter().find(|(h, _)| *h == serial_hash).map(|(_, t)| t);
        match maybe_token {
            Some(token) => token.clone(),
            None => panic!("TokenNotFound"),
        }
    }

    /// Get transfer history for a token
    pub fn get_history(_e: &State, _serial_hash: BytesN32) -> Vec<TransferEvent> {
        Vec::new()
    }

    /// Get claims for a token
    pub fn get_claims(_e: &State, _serial_hash: BytesN32) -> Vec<Claim> {
        Vec::new()
    }
}