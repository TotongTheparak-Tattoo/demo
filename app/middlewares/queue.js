const BeeQueue = require("bee-queue")
const InboundService = require("../services/inbound.service")
const REDIS_SETUP = {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
    }
}
//naming queue uniquely is recommended before the deployment.
const queueList = {
    "receiveAutoQueueCoil": new BeeQueue("1_bpi_wms_vmi_receive_auto_coil_production", REDIS_SETUP).process(async (job) => {
        const { getProductDetailsData, matchedData, getAvailableLocation } = job.data
        const result = await InboundService.doInboundReceiveCoilAuto(getProductDetailsData, matchedData, getAvailableLocation)
        
        let printData = null;
        if (result === "ok") {
            printData = await InboundService.getDataPrintPalletNote(getProductDetailsData);
        }
        
        return { 
            "status": result,
            "printData": printData
        }
    }),
    "receiveAutoQueuePcs": new BeeQueue("2_bpi_wms_vmi_receive_auto_pcs_production", REDIS_SETUP).process(async (job) => {
        const { getProductDetailsData, matchedData, getAvailableLocation } = job.data
        const result = await InboundService.doInboundReceivePcsAuto(getProductDetailsData, matchedData, getAvailableLocation)
        
        let printData = null;
        if (result === "ok") {
            printData = await InboundService.getDataPrintPalletNote(getProductDetailsData);
        }
        
        return { 
            "status": result,
            "printData": printData
        }
    }),
    "receiveManualQueueCoil": new BeeQueue("3_bpi_wms_vmi_receive_manual_coil_production", REDIS_SETUP).process(async (job) => {
        const { getProductDetailsData, matchedData, getLocationById } = job.data
        const result = await InboundService.doInboundReceiveManualCoil(getProductDetailsData, matchedData, getLocationById)
        
        let printData = null;
        if (result === "ok") {
            printData = await InboundService.getDataPrintPalletNote(getProductDetailsData);
        }
        
        return { 
            "status": result,
            "printData": printData
        }
    }),
    "receiveManualQueuePcs": new BeeQueue("4_bpi_wms_vmi_receive_manual_pcs_production", REDIS_SETUP).process(async (job) => {
        const { getProductDetailsData, matchedData, getLocationById } = job.data
        const result = await InboundService.doInboundReceiveManualPcs(getProductDetailsData, matchedData, getLocationById)
        
        let printData = null;
        if (result === "ok") {
            printData = await InboundService.getDataPrintPalletNote(getProductDetailsData);
        }
        
        return { 
            "status": result,
            "printData": printData
        }
    })
}

class Queue {
    async doProcess(queueName, data) {
        try {
            const queueInstance = queueList[queueName]
            
            const job = queueInstance.createJob(data)
            await job.save()
            
            // use Promise and event listeners for BeeQueue
            const result = await new Promise((resolve, reject) => {
                job.on('succeeded', (result) => {
                    console.log("Job succeeded with result:", result)
                    resolve(result)
                })
                
                job.on('failed', (error) => {
                    console.log("Job failed with error:", error)
                    reject(error)
                })
                
                setTimeout(() => {
                    reject(new Error('Job timeout'))
                }, 30000) 
            })
            
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