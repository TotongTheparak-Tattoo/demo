const InboundService = require("../services/inbound.service")

// Process handlers without Redis queue (synchronous execution)
const processHandlers = {
    "receiveAutoQueueCoil": async (data) => {
        const { getProductDetailsData, matchedData, getAvailableLocation } = data
        const result = await InboundService.doInboundReceiveCoilAuto(getProductDetailsData, matchedData, getAvailableLocation)
        
        let printData = null;
        if (result === "ok") {
            printData = await InboundService.getDataPrintPalletNote(getProductDetailsData);
        }
        
        return { 
            "status": result,
            "printData": printData
        }
    },
    "receiveAutoQueuePcs": async (data) => {
        const { getProductDetailsData, matchedData, getAvailableLocation } = data
        const result = await InboundService.doInboundReceivePcsAuto(getProductDetailsData, matchedData, getAvailableLocation)
        
        let printData = null;
        if (result === "ok") {
            printData = await InboundService.getDataPrintPalletNote(getProductDetailsData);
        }
        
        return { 
            "status": result,
            "printData": printData
        }
    },
    "receiveManualQueueCoil": async (data) => {
        const { getProductDetailsData, matchedData, getLocationById } = data
        const result = await InboundService.doInboundReceiveManualCoil(getProductDetailsData, matchedData, getLocationById)
        
        let printData = null;
        if (result === "ok") {
            printData = await InboundService.getDataPrintPalletNote(getProductDetailsData);
        }
        
        return { 
            "status": result,
            "printData": printData
        }
    },
    "receiveManualQueuePcs": async (data) => {
        const { getProductDetailsData, matchedData, getLocationById } = data
        const result = await InboundService.doInboundReceiveManualPcs(getProductDetailsData, matchedData, getLocationById)
        
        let printData = null;
        if (result === "ok") {
            printData = await InboundService.getDataPrintPalletNote(getProductDetailsData);
        }
        
        return { 
            "status": result,
            "printData": printData
        }
    }
}

class Queue {
    async doProcess(queueName, data) {
        try {
            const handler = processHandlers[queueName]
            
            if (!handler) {
                throw new Error(`Unknown queue name: ${queueName}`)
            }
            
            // Execute synchronously without Redis queue
            const result = await handler(data)
            
            return { 
                success: true, 
                message: 'Job completed successfully',
                result: result.status,
                printData: result.printData
            }
        } catch (error) {
            console.log("Queue error:", error)
            throw `Cannot place in the selected location. Please choose a new location.`;
        }
    }
}

module.exports = new Queue()