const {Socket} = require('net')
const {
    APIClient,
    Checksum256,
    FetchProvider,
    P2P,
    P2PClient,
    PrivateKey,
    SimpleEnvelopeP2PProvider,
} = require('@wharfkit/antelope')
const fetch = require('node-fetch')

const socket = new Socket()
socket.connect(9876, 'jungle4.greymass.com')

const client = new P2PClient({
    provider: new SimpleEnvelopeP2PProvider(socket),
})

// Establish API Client and embedding fetch for nodejs below v18
const fetchProvider = new FetchProvider('https://jungle4.greymass.com', {fetch})
const apiClient = new APIClient({provider: fetchProvider})

async function run() {
    // Request current chain state via get_info call to sync from this point forward
    const info = await apiClient.v1.chain.get_info()
    const token = Checksum256.hash(info.head_block_time.value.byteArray)

    // Generate a key pair for usage in our messages
    const privateKey = PrivateKey.generate('K1')
    const publicKey = privateKey.toPublic()

    // Assemble the P2P.HandshakeMessage
    const handshake = P2P.HandshakeMessage.from({
        networkVersion: 0xfe,
        chainId: info.chain_id,
        nodeId: Checksum256.hash(publicKey.data),
        key: publicKey,
        time: info.head_block_time.value,
        token,
        sig: privateKey.signDigest(token),
        p2pAddress: 'none',
        lastIrreversibleBlockNumber: info.last_irreversible_block_num,
        lastIrreversibleBlockId: info.last_irreversible_block_id,
        headNum: info.head_block_num,
        headId: info.head_block_id,
        os: 'nodejs',
        agent: 'wharfkit/antelope',
        generation: 4,
    })

    // Send the connected client the message
    client.send(handshake)

    client.on('message', (msg) => {
        // Each message received has a type and data
        const {value} = msg
        // For the sake of seeing socket activity, dump everything to the console
        console.log(value)
        // Switch based on message type
        switch (value.constructor) {
            // If we receive a time_message...
            case P2P.TimeMessage: {
                // Assemble a response using the current time
                const payload = P2P.TimeMessage.from({
                    org: Date.now(),
                    rec: 0,
                    xmt: 0,
                    dst: 0,
                })
                // Respond to the peer to let them know this connection is alive
                client.send(payload)
                break
            }
            default: {
                break
            }
        }
    })
}

run()
