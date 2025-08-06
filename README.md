# AsyncAPI C# Kafka Template
This project provides a generator for creating C# code from AsyncAPI specifications, designed to work with Kafka in both JSON and Avro formats. The solution directly generates C# code without relying on the AsyncAPI generator's template system. The project is hosted in Azure DevOps at [asyncapi-csharp-kafka-template](https://dev.azure.com/tqlweb/Enterprise%20IT/_git/asyncapi-csharp-kafka-template).
*** not a comprehensive working project***

## Features

- **Generate C# Models**: Create C# POCOs/models from AsyncAPI message objects

- **Message Schemas**: Generate Avro, JSON, and Protocol Buffers schemas

- **Terraform Scripts**: Create Terraform scripts for Kafka topic definitions and schema registry

- **Kafka Client Code**: Produce stub programs to produce/consume from a Kafka topic (Confluent Cloud)

- **Dual Serialization Support**: Support for multiple serialization formats


## Prerequisites

- Node.js and npm

- .NET 6.0 SDK or newer

- PowerShell 7.0 or newer (for Windows)
### Solution structure
```
asyncapi-csharp-kafka-project/
|-- asyncapi-generator.js
|-- customer-avro-simple.yaml
|-- Generate-AsyncAPI.ps1
|-- package.json
|-- /partials/
|   |-- avroSerializer.cs.hbs
|   |-- jsonSerializer.cs.hbs
|   |-- kafkaConsumer.cs.hbs
|   |-- kafkaProducer.cs.hbs
|-- /template/
|   |-- appsettings.json.hbs
|   |-- {{serviceName}}.csproj.hbs
|   |-- /src/
|       |-- Program.cs.hbs
|       |-- /Kafka/
|           |-- KafkaConsumerService.cs.hbs
|           |-- KafkaProducerService.cs.hbs
|       |-- /Models/
|           |-- {{className}}.cs.hbs
|       |-- /Serialization/
|           |-- AvroSerializationService.cs.hbs
|           |-- JsonSerializationService.cs.hbs
|   |-- /test/
|       |-- IntegrationTests.cs.hbs
|       |-- SerializationTests.cs.hbs
|       |-- UnitTests.cs.hbs
```

## Installation

1. Clone this repository:

   ```
   git clone 
   cd asyncapi-csharp-kafka-template
   ```

2. Install the required Node.js packages:

   ```
   npm install
   ```

## Usage

Use the provided PowerShell script to generate code from your AsyncAPI specification. The generator extracts Kafka cluster information from your AsyncAPI spec's servers section:

```yaml

# AsyncAPI spec servers section example

servers:
  cluster:
    url: abc-xxxxx.region.aws.confluent.cloud:9092  # Kafka bootstrap servers
    protocol: kafka
    description: Confluent Cloud Kafka cluster
    security:
    - confluentBroker: []  # Security scheme for Kafka broker
  schema-registry:
    url: https://psrc-xxxxx.region.aws.confluent.cloud  # Schema Registry URL
    protocol: schema-registry
    description: Confluent Schema Registry
    security:
    - confluentSchemaRegistry: []  # Security scheme for Schema Registry
# Optional security schemes definition
components:
  securitySchemes:
    confluentBroker:
      type: userPassword
      x-configs:
        sasl.mechanisms: PLAIN
        security.protocol: sasl_ssl
    confluentSchemaRegistry:
      type: userPassword
```

You can provide other configuration options in multiple ways, with the following priority order (highest to lowest):
1. Command line parameters (highest priority)
2. Environment file (.env format) specified via command line
3. Configuration file (JSON or YAML) specified via command line
4. Default configuration files (`generator-input.yaml`, `generator-input.json`, `generator-input.env`)
5. Environment variables
6. Default parameters (lowest priority)

### Default Configuration Files
The generator now automatically checks for the following default configuration files in the current directory:
- `generator-input.yaml` - YAML configuration file
- `generator-input.json` - JSON configuration file
- `generator-input.env` - Environment configuration file

These files will be used automatically if they exist and no explicit configuration files are specified.
When multiple configuration sources are used, values from higher priority sources override those from lower priority sources.

```powershell
# Basic usage with command line parameters
.\Generate-AsyncAPI.ps1 -SpecFile <path-to-asyncapi-yaml> -OutputDir <output-directory> -ServiceName <service-name> -Namespace <namespace>
# Using a configuration file with spec file included in config
.\Generate-AsyncAPI.ps1 -OutputDir <output-directory> -ConfigFile <path-to-config-file>
# Using a configuration file but overriding the spec file
.\Generate-AsyncAPI.ps1 -SpecFile <path-to-asyncapi-yaml> -OutputDir <output-directory> -ConfigFile <path-to-config-file>
```
### Configuration File Format
You can use either JSON or YAML format for your configuration file. The generator extracts Kafka settings from the AsyncAPI spec's servers section, so you only need to specify application-level settings in your config files.
**sample-config.json**:
```json
{
  "serviceName": "Customer",
  "namespace": "Org.Domain.ProductLine.Product",
  "specFile": "customer-avro-simple.yaml",
  "serializationFormat": "both",
  "className": "Customer",
  "environment": "dev",
  "region": "us-east-1",
  "useProtobuf": "true",
  // Optional: API keys can be provided via environment variables
  "confluentCloudApiKey": "${env:API_KEY}",
  "confluentCloudApiSecret": "${env:API_SECRET}"
}
```

**sample-config.yaml**:
```yaml
# AsyncAPI Generator Configuration
serviceName: Customer
namespace: Org.Domain.ProductLine.Product
serializationFormat: both
className: Customer
environment: dev
region: us-east-1
useProtobuf: "true"
specFile: customer-avro-simple.yaml
# Optional: API keys can be provided via environment variables
confluentCloudApiKey: ${env:API_KEY}
confluentCloudApiSecret: ${env:API_SECRET}
```



### Environment File Format
You can also use a .env file to configure the generator. While Kafka connection settings are extracted from the AsyncAPI spec, you can still use environment variables for sensitive information like API keys.
**sample.env**:
```
# Confluent Cloud authentication
API_KEY=YOUR_API_KEY
API_SECRET=YOUR_API_SECRET
# Application settings
SERVICE_NAME=Customer
NAMESPACE=Org.Domain.ProductLine.Product
CLASS_NAME=Customer
SERIALIZATION_FORMAT=both
USE_PROTOBUF=true
# Infrastructure settings
ENVIRONMENT=dev
REGION=us-east-1
```


### Parameters
- **SpecFile** (optional if using ConfigFile with specFile property): Path to your AsyncAPI specification file
- **OutputDir** (required): Output directory for generated files
- **ConfigFile** (optional): Path to a JSON or YAML configuration file
- **EnvFile** (optional): Path to a .env format environment file
- **ServiceName** (optional): Name of the service (default: KafkaService)
- **Namespace** (optional): C# namespace (default: AsyncAPI.KafkaClient)
- **SerializationFormat** (optional): "json", "avro", or "both" (default: both)
- **UseProtobuf** (optional): "true" or "false" (default: false)
- **Environment** (optional): Environment for Terraform (default: dev)
- **Region** (optional): AWS region for Terraform (default: us-east-1)

Note: The following parameters are now automatically extracted from the AsyncAPI specification file:
- Bootstrap Servers: Extracted from `servers.cluster.url`
- Schema Registry URL: Extracted from `servers.schema-registry.url`
- Topics Configuration: Extracted from `channels` section including:
  - Topic names
  - Consumer group IDs
  - Topic configurations

### Examples
#### Using Command Line Parameters:
```powershell
.\Generate-AsyncAPI.ps1 -SpecFile .\sample-asyncapi.yaml -OutputDir .\weather-client -ServiceName WeatherService -Namespace Weather.KafkaClient -UseProtobuf "true"
```
#### Using a Configuration File:

```powershell
.\Generate-AsyncAPI.ps1 -OutputDir .\weather-client -ConfigFile .\sample-config.json
```

#### Using a Configuration File and Overriding the Spec File:

```powershell
.\Generate-AsyncAPI.ps1 -SpecFile .\custom-asyncapi.yaml -OutputDir .\weather-client -ConfigFile .\sample-config.json
```
#### Using an Environment File:

```powershell
.\Generate-AsyncAPI.ps1 -SpecFile .\sample-asyncapi.yaml -OutputDir .\weather-client -EnvFile .\sample.env
```

#### Combining Configuration Methods:

```powershell
.\Generate-AsyncAPI.ps1 -SpecFile .\sample-asyncapi.yaml -OutputDir .\weather-client -ConfigFile .\sample-config.json -EnvFile .\sample.env
```
## Generated Files
The generator creates:
1. C# models in `<output-dir>/src/Models/`
2. Schema definitions in `<output-dir>/schemas/` (Avro, JSON, and optionally Protobuf)
3. Terraform deployment files in `<output-dir>/terraform/`
4. Kafka producer/consumer code in `<output-dir>/src/Kafka/`
5. Project files and configuration in `<output-dir>/`

## Building and Deploying the Generated Code
After generating the code:
1. Build the C# project:
   ```
   dotnet build <output-dir>/<ServiceName>.csproj
   ```

2. Deploy the Kafka infrastructure with Terraform:
   ```
   cd <output-dir>/terraform
   terraform init
   terraform apply
   ```

### Kafka Configuration
The generated code includes an `appsettings.json` file for configuring Kafka:

```json
{
  "Kafka": {
    "BootstrapServers": "localhost:9092",
    "SchemaRegistryUrl": "http://localhost:8081",
    "Topic": "my-service.topic",
    "ConsumerGroup": "my-service.consumer",
    "SerializationFormat": "both"
  }
}
```

Adjust these settings to match your Kafka environment.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
