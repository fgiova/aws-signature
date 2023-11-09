const {randomUUID, createHmac} = require("crypto");
const Benchmark = require("benchmark");
process.env.AWS_ACCESS_KEY_ID = "foo";
process.env.AWS_SECRET_ACCESS_KEY = "bar";
const { Signer } = require("../dist/index");
const { Sha256 } = require("@aws-crypto/sha256-js");
const { HttpRequest } = require("@smithy/protocol-http");
const { SignatureV4 } = require("@smithy/signature-v4");
const signerfgiova = new Signer();
const suite = new Benchmark.Suite("Signer Performance Test", {
    minSamples: 10,
    onCycle: (e) => {
        const benchmark = e.target;
        console.log(benchmark.toString());
    },
    onComplete: async (e) => {
        const suite = e.currentTarget;
        const fastestOption = suite.filter("fastest").map("name");
        console.log(`The fastest option is ${fastestOption}`);
        await signerfgiova.destroy();
        process.exit(0);
    }
});
suite.add("AWS Signature @fgiova",  async function (){
    const service = randomUUID();
    const requestData = {
        method: "POST",
        path: "/",
        headers: {
            host: `${service}.us-bar-1.amazonaws.com`,
        }
    }
    const date = new Date("2000-01-01T00:00:00.000Z");
    return signerfgiova.request(requestData, service, "us-bar-1", date);

});
suite.add("AWS Signature @aws-sdk", async function () {
        const signerInit = {
            service: randomUUID(),
            region: "us-bar-1",
            sha256: Sha256,
            credentials: {
                accessKeyId: "foo",
                secretAccessKey: randomUUID(),
            },
        };

        const minimalRequest = new HttpRequest({
            method: "POST",
            protocol: "https:",
            path: "/",
            headers: {
                host: `${signerInit.service}.us-bar-1.amazonaws.com`,
            },
            hostname: `${signerInit.service}.us-bar-1.amazonaws.com`
        });

        let signer = new SignatureV4(signerInit);
        const { headers } = await signer.sign(minimalRequest.clone(), {
            signingDate: new Date("2000-01-01T00:00:00.000Z"),
        });
        return headers;

});
suite.run({async: true});