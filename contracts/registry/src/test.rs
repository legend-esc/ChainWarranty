// Day 1 Test Cases for ChainWarranty Contract
// These tests cover the gaps named in README.md's Testing section

// Test 1: Filing a claim after the warranty term has elapsed should fail with WarrantyExpired
#[test]
#[should_panic(expected = "WarrantyExpired")]
fn expired_claim_should_fail() {
    let mut state = super::State::new();

    // Initialize admin
    let admin: [u8; 32] = [0u8; 32];
    super::Registry::initialize(&mut state, admin);

    // Add a test manufacturer
    let manufacturer: [u8; 32] = [1u8; 32];
    super::Registry::add_manufacturer(&mut state, &admin, manufacturer, "Test Mfr".to_string());

    // Mint a token with 0 month warranty (immediately expired)
    let serial_hash: [u8; 32] = [0u8; 32];
    let product_id = "product-001".to_string();
    let initial_owner: [u8; 32] = [2u8; 32];
    super::Registry::mint_token(
        &mut state,
        &admin,       // caller (admin)
        manufacturer, // manufacturer
        serial_hash,
        product_id,
        0, // 0 month warranty - immediately expired
        initial_owner,
    );

    // Try to file a claim - should fail with WarrantyExpired since warranty is 0
    let claimant: [u8; 32] = [3u8; 32];
    let description = "Defective product".to_string();
    super::Registry::file_claim(&mut state, &claimant, serial_hash, description);
}

// Test 2: Minting from an address that was added via add_manufacturer but then deactivated via set_manufacturer_active should fail with ManufacturerInactive
#[test]
#[should_panic(expected = "ManufacturerInactive")]
fn inactive_manufacturer_mint_should_fail() {
    let mut state = super::State::new();

    // Initialize admin
    let admin: [u8; 32] = [0u8; 32];
    super::Registry::initialize(&mut state, admin);

    // Add a manufacturer and then deactivate it
    let manufacturer: [u8; 32] = [1u8; 32];
    super::Registry::add_manufacturer(&mut state, &admin, manufacturer, "Test Mfr".to_string());
    // Deactivate the manufacturer
    super::Registry::set_manufacturer_active(&mut state, &admin, manufacturer, false);

    // Try to mint as deactivated manufacturer - should fail with ManufacturerInactive
    let serial_hash: [u8; 32] = [1u8; 32];
    let product_id = "product-002".to_string();
    let initial_owner: [u8; 32] = [2u8; 32];
    super::Registry::mint_token(
        &mut state,
        &admin,       // caller (admin)
        manufacturer, // manufacturer
        serial_hash,
        product_id,
        1,
        initial_owner,
    );
}

// Test 3: Calling transfer_ownership from an address that is not the current owner should fail authorization
#[test]
#[should_panic(expected = "NotOwner")]
fn unauthorized_transfer_should_fail() {
    let mut state = super::State::new();

    // Initialize admin
    let admin: [u8; 32] = [0u8; 32];
    super::Registry::initialize(&mut state, admin);

    // Add a test manufacturer
    let manufacturer: [u8; 32] = [1u8; 32];
    super::Registry::add_manufacturer(&mut state, &admin, manufacturer, "Test Mfr".to_string());

    // Mint a token
    let serial_hash: [u8; 32] = [2u8; 32];
    let product_id = "product-003".to_string();
    let original_owner: [u8; 32] = [3u8; 32];
    super::Registry::mint_token(
        &mut state,
        &admin,       // caller (admin)
        manufacturer, // manufacturer
        serial_hash,
        product_id,
        1,
        original_owner,
    );

    // Try to transfer ownership from a different address - should fail with NotOwner
    let new_owner: [u8; 32] = [4u8; 32];
    super::Registry::transfer_ownership(
        &mut state,
        &new_owner, // Not the owner
        serial_hash,
        new_owner,
    );
}