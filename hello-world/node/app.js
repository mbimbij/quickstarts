// ------------------------------------------------------------
// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.
// ------------------------------------------------------------

const express = require('express');
require('isomorphic-fetch');
const app = express();
app.use(express.json());

const daprPort = process.env.DAPR_HTTP_PORT || 3500;
const stateStoreName = `statestore`;
const stateUrl = `http://localhost:${daprPort}/v1.0/state/${stateStoreName}`;
const port = 3000;

const {
    Tracer,
    BatchRecorder,
    jsonEncoder: {JSON_V2}
} = require('zipkin');
const CLSContext = require('zipkin-context-cls');
const {HttpLogger} = require('zipkin-transport-http');

// Setup the tracer
const tracer = new Tracer({
    ctxImpl: new CLSContext('zipkin'), // implicit in-process context
    recorder: new BatchRecorder({
        logger: new HttpLogger({
            endpoint: 'http://localhost:9411/api/v2/spans',
            jsonEncoder: JSON_V2
        })
    }), // batched http recorder
    localServiceName: 'nodeapp' // name of this application
});

// now use tracer to construct instrumentation! For example, fetch
const wrapFetch = require('zipkin-instrumentation-fetch');

const remoteServiceName = 'statestore'; // name of the application that
                                     // will be called (optional)
const zipkinFetch = wrapFetch(fetch, {tracer, remoteServiceName});

function prettyJSON(obj) {
    console.log(JSON.stringify(obj, null, 2));
}

app.get('/order', (_req, res) => {
    console.log("Querying order!");
    console.log(JSON.stringify(_req.headers));
    // fetch(`${stateUrl}/order`)
    //     .then((response) => {
    //         if (!response.ok) {
    //             throw "Could not get state.";
    //         }
    //         console.log("got response for order");
    //         console.log(JSON.stringify(response.headers));
    //         return response.text();
    //     }).then((orders) => {
    //         res.send(orders);
    //     }).catch((error) => {
    //         console.log(error);
    //         res.status(500).send({message: error});
    //     });
    zipkinFetch(`${stateUrl}/order`)
        .then((response) => {
            if (!response.ok) {
                throw "Could not get state.";
            }
            console.log("got response for order");
            console.log(JSON.stringify(response.headers));
            return response.text();
        }).then((orders) => {
        res.send(orders);
    }).catch((error) => {
        console.log(error);
        res.status(500).send({message: error});
    });
});

app.post('/neworder', (req, res) => {
    console.log("Received " +  prettyJSON(req.body));
    console.log(JSON.stringify(req.headers));
    const data = req.body.data;
    const orderId = data.orderId;
    console.log("Got a new order! Order ID: " + orderId);

    const state = [{
        key: "order",
        value: data
    }];

    fetch(stateUrl, {
        method: "POST",
        body: JSON.stringify(state),
        headers: {
            "Content-Type": "application/json"
        }
    }).then((response) => {
        if (!response.ok) {
            throw "Failed to persist state.";
        }

        console.log("Successfully persisted state.");
        console.log(JSON.stringify(response.headers));
        res.status(200).send();
    }).catch((error) => {
        console.log(error);
        res.status(500).send({message: error});
    });
});

app.listen(port, () => console.log(`Node App listening on port ${port}!`));
