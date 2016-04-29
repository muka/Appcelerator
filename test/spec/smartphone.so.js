exports.definition = {
    "name": "Test Phone",
    "description": "My test phone",
    "URL": null,
    "public": false,
    "streams": {
        "mylocation": {
            "description": "SO location",
            "type": "sensor",
            "channels": {
                "latitude": {
                    "type": "number"
                },
                "longitude": {
                    "type": "number"
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
                "location": {
                    type: "geo_point"
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
