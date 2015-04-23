exports.definition = {
    "name": "Test Phone",
    "description": "My test phone",
    "URL": null,
    "public": false,
    "streams": {
        "location": {
            "description": "SO location",
            "type": "sensor",
            "channels": {
                "latitude": {
                    "type": "string"
                },
                "longitude": {
                    "type": "string"
                }
            }
        },
        "test": {
            type: "sensor",
            channels: {
                "testnumeric": {
                    type: "number"
                },
                "testtext": {
                    type: "string"
                },
                "testlocation": {
                    type: "string"
                }
            }
        }
    },
    "customFields": {
        "testsuite": true,
        "hashnumber": "xxxxxyyyyyzzzzzzzzzz",
        "phone_details": {
            model: "some model",
            os: "android",
            api: "19"
        }
    },
    "actions": [
        {
            "name": "notify",
            "description": "Create a notification"
        },
    ],
    "properties": []
};