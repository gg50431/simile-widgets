/*==================================================
 *  Exhibit.JSONPImporter
 *==================================================
 */
 
Exhibit.JSONPImporter = {
    _callbacks: {}
};
Exhibit.importers["application/jsonp"] = Exhibit.JSONPImporter;

// cont gets called with the original feed (so you can pick up details from the
// feed from user code that were of interest to you but not the exhibit itself,
// for instance). load returns the callback that the JSONP payload should call,
// so that even partial static JSONP implementations (with a constantly named
// callback) can assign that variable with the return value, and things will
// work out, as much as they can (i e concurrent requests can get mixed up).
Exhibit.JSONPImporter.load = function(link, database, cont, fConvert) {
    var url = link;
    if (typeof link != "string") {
        url = Exhibit.resolveURL(link.href);
        fConvert = Exhibit.getAttribute(link, 'converter');
        try {
            fConvert = eval(fConvert);
        } catch (e) {
            fConvert = null;
            // silent
        }
    }

    var next = Exhibit.JSONPImporter._callbacks.next || 1;
    Exhibit.JSONPImporter._callbacks.next = next + 1;
    
    var callbackName = "cb" + next.toString(36);
    var callbackURL = url;
    if (callbackURL.indexOf("?") == -1)
        callbackURL += "?";
        
    var lastChar = callbackURL.charAt(callbackURL.length - 1);
    if (lastChar != "=") {
        if (lastChar != '&' && lastChar != "?")
            callbackURL += "&";
            
        callbackURL += 'callback=';
    }

    callbackURL += "Exhibit.JSONPImporter._callbacks." + callbackName;

    Exhibit.JSONPImporter._callbacks[callbackName] = function(json) {
        try {
            Exhibit.hideBusyIndicator();

            delete Exhibit.JSONPImporter._callbacks[callbackName];
            if (script && script.parentNode) {
                script.parentNode.removeChild(script);
            }
            
            database.loadData(fConvert ? fConvert(json, url) : json,
                              Exhibit.getBaseURL(url));
        } finally {
            if (cont) cont(json);
        }
    };
    
    var script = SimileAjax.includeJavascriptFile(document, callbackURL);
    Exhibit.showBusyIndicator();
    return Exhibit.JSONPImporter._callbacks[callbackName];
};

Exhibit.JSONPImporter.googleSpreadsheetsConverter = function(json, url) {
    var items = [];
    var properties = {};
    var types = {};
    var valueTypes = { "text" : true, "number" : true, "item" : true, "url" : true, "boolean" : true };
    
    var entries = json.feed.entry;
    for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        var item = { label: entry.title.$t };
        var fields = entry.content.$t;
        
        var openBrace = fields.indexOf("{");
        while (openBrace >= 0) {
            var closeBrace = fields.indexOf("}", openBrace+1);
            if (closeBrace < 0) {
                break;
            }
            
            var fieldSpec = fields.substring(openBrace+1, closeBrace).trim().split(":");
            openBrace = fields.indexOf("{", closeBrace+1);
            
            var fieldValues = openBrace > 0 ? fields.substring(closeBrace+1, openBrace) : fields.substr(closeBrace+1);
            fieldValues = fieldValues.replace(/^\:\s+|,\s+$/g, "");
            
            var fieldName = fieldSpec[0].trim();
            var property = properties[fieldName];
            if (!(property)) {
                var fieldDetails = fieldSpec.length > 1 ? fieldSpec[1].split(",") : [];
                property = {};
                
                for (var d = 0; d < fieldDetails.length; d++) {
                    var detail = fieldDetails[d].trim();
                    var property = { single: false };
                    if (detail in valueTypes) {
                        property.valueType = detail;
                    } else if (detail == "single") {
                        property.single = true;
                    }
                }
                
                properties[fieldName] = property;
            }
            
            if (!property.single) {
                fieldValues = fieldValues.split(";");
                for (var v = 0; v < fieldValues.length; v++) {
                    fieldValues[v] = fieldValues[v].trim();
                }
            }
            item[fieldName] = fieldValues;
        }
        items.push(item);
    }
  
    return { types:types, properties:properties, items:items };
};
