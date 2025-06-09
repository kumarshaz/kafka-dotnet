Here is my generator file:

/**

 * AsyncAPI Generator for C# Kafka Clients

 *

 * This script generates:

 * 1. C# POCOs/models from AsyncAPI message objects

 * 2. Message schemas (Avro, JSON, and Protocol Buffers)

 * 3. Terraform scripts for topic definitions and schema registry

 * 4. Kafka producer/consumer stub program for Confluent Cloud

 *

 * Parameters can be loaded from a config file, environment variables, or command-line arguments

 */



const fs = require('fs');

const path = require('path');

const yaml = require('js-yaml');

const handlebars = require('handlebars');

const { Command } = require('commander');



// Parse command line arguments

const program = new Command();

program

  .option('-s, --spec <specFile>', 'AsyncAPI specification file')

  .option('-o, --output <outputDir>', 'Output directory')

  .option('-p, --params <parameters>', 'Comma-separated parameters (name=value)', parseParams)

  .option('-c, --config <configFile>', 'Configuration file (JSON or YAML)')

  .option('-e, --env <envFile>', 'Environment file (.env format)')

  .parse(process.argv);



const options = program.opts();



/**

 * Load configuration from multiple sources in this priority order:

 * 1. Command line parameters (highest priority)

 * 2. Environment file (.env) specified via command line

 * 3. Config file (JSON/YAML) specified via command line

 * 4. Default configuration files (generator-input.yaml, generator-input.json, generator-input.env)

 * 5. Environment variables

 * 6. Default parameters (lowest priority)

 */



// Default parameters

const defaultParams = {

  serviceName: 'KafkaService',

  namespace: 'AsyncAPI.KafkaClient',

  serializationFormat: 'both',  className: 'KafkaMessage',

  // Terraform parameters

  environment: 'dev',

  region: 'us-east-1',

  confluentCloudApiKey: '${var.confluent_cloud_api_key}',

  confluentCloudApiSecret: '${var.confluent_cloud_api_secret}',

  // Protobuf options

  useProtobuf: 'false',

  // AsyncAPI spec file

  specFile: 'sample-asyncapi.yaml',

  // Kafka parameters - these will be populated from AsyncAPI spec

  bootstrapServers: '',

  schemaRegistryUrl: '',

  groupId: '',

  channels: {}

};



// Check for default configuration files

const DEFAULT_CONFIG_FILES = {

  yaml: 'generator-input.yaml',

  json: 'generator-input.json',

  env: 'generator-input.env'

};



// Load parameters from default config file (generator-input.json, generator-input.yaml)

let defaultConfigParams = {};

if (!options.config) {

  // Try JSON first

  if (fs.existsSync(path.resolve(DEFAULT_CONFIG_FILES.json))) {

    try {

      const configPath = path.resolve(DEFAULT_CONFIG_FILES.json);

      const configContent = fs.readFileSync(configPath, 'utf8');

      defaultConfigParams = JSON.parse(configContent);

      console.log(`Loaded default JSON configuration from ${configPath}`);

     

      // Process environment variable references in config values

      Object.keys(defaultConfigParams).forEach(key => {

        const value = defaultConfigParams[key];

        if (typeof value === 'string' && value.includes('${env:')) {

          // Replace ${env:VAR_NAME} with environment variable values

          defaultConfigParams[key] = value.replace(/\${env:([^}]+)}/g, (match, varName) => {

            const envValue = process.env[varName];

            if (envValue === undefined) {

              console.warn(`Warning: Environment variable ${varName} not found, referenced in default config file`);

              return match; // Keep the original reference if env var not found

            }

            return envValue;

          });

        }

      });

    } catch (error) {

      console.error(`Error loading default JSON config file: ${error.message}`);

      console.error('Will try YAML configuration or continue with other sources.');

    }

  }

  // Try YAML if JSON wasn't found or had errors

  else if (fs.existsSync(path.resolve(DEFAULT_CONFIG_FILES.yaml))) {

    try {

      const configPath = path.resolve(DEFAULT_CONFIG_FILES.yaml);

      const configContent = fs.readFileSync(configPath, 'utf8');

      defaultConfigParams = yaml.load(configContent);

      console.log(`Loaded default YAML configuration from ${configPath}`);



      // Process environment variable references in config values

      Object.keys(defaultConfigParams).forEach(key => {

        const value = defaultConfigParams[key];

        if (typeof value === 'string' && value.includes('${env:')) {

          // Replace ${env:VAR_NAME} with environment variable values

          defaultConfigParams[key] = value.replace(/\${env:([^}]+)}/g, (match, varName) => {

            const envValue = process.env[varName];

            if (envValue === undefined) {

              console.warn(`Warning: Environment variable ${varName} not found, referenced in default config file`);

              return match; // Keep the original reference if env var not found

            }

            return envValue;

          });

        }

      });

    } catch (error) {

      console.error(`Error loading default YAML config file: ${error.message}`);

      console.error('Continuing with other configuration sources.');

    }

  }

}



// Load parameters from config file if specified

let configParams = {};

if (options.config) {

  try {

    const configPath = path.resolve(options.config);

    const configContent = fs.readFileSync(configPath, 'utf8');

   

    if (configPath.endsWith('.json')) {

      configParams = JSON.parse(configContent);

      console.log(`Loaded JSON configuration from ${configPath}`);

    } else if (configPath.endsWith('.yaml') || configPath.endsWith('.yml')) {

      configParams = yaml.load(configContent);

      console.log(`Loaded YAML configuration from ${configPath}`);

    } else {

      console.warn(`Unsupported config file format: ${configPath}. Using default parameters.`);

      console.warn('Supported formats are .json, .yaml, and .yml');

    }

   

    // Process environment variable references in config values

    Object.keys(configParams).forEach(key => {

      const value = configParams[key];

      if (typeof value === 'string' && value.includes('${env:')) {

        // Replace ${env:VAR_NAME} with environment variable values

        configParams[key] = value.replace(/\${env:([^}]+)}/g, (match, varName) => {

          const envValue = process.env[varName];

          if (envValue === undefined) {

            console.warn(`Warning: Environment variable ${varName} not found, referenced in config file`);

            return match; // Keep the original reference if env var not found

          }

          return envValue;

        });

      }

    });

  } catch (error) {

    console.error(`Error loading config file: ${error.message}`);

    console.error('Continuing with default parameters or other configuration sources.');

  }

}



// Load parameters from .env file if specified

let envParams = {};

if (options.env) {

  try {

    const envPath = path.resolve(options.env);

    const envContent = fs.readFileSync(envPath, 'utf8');

   

    // Parse .env file

    envContent.split('\n').forEach(line => {

      line = line.trim();

      if (!line || line.startsWith('#') || line.startsWith('//')) return; // Skip empty lines and comments

     

      const match = line.match(/^([^=]+)=(.*)$/);

      if (match) {

        const key = match[1].trim();

        const value = match[2].trim().replace(/^["'](.*)["']$/, '$1'); // Remove quotes if present

       

        // Map environment variables to parameter names

        processEnvVar(key, value, envParams);

      }

    });

   

    console.log(`Loaded environment from ${envPath}`);

  } catch (error) {

    console.error(`Error loading .env file: ${error.message}`);

    console.error('Continuing with default parameters or other configuration sources.');

  }

}

// Check for default environment file

else if (fs.existsSync(path.resolve(DEFAULT_CONFIG_FILES.env))) {

  try {

    const envPath = path.resolve(DEFAULT_CONFIG_FILES.env);

    const envContent = fs.readFileSync(envPath, 'utf8');

   

    // Parse .env file

    envContent.split('\n').forEach(line => {

      line = line.trim();

      if (!line || line.startsWith('#') || line.startsWith('//')) return; // Skip empty lines and comments

     

      const match = line.match(/^([^=]+)=(.*)$/);

      if (match) {

        const key = match[1].trim();

        const value = match[2].trim().replace(/^["'](.*)["']$/, '$1'); // Remove quotes if present

       

        // Map environment variables to parameter names

        processEnvVar(key, value, envParams);

      }

    });

   

    console.log(`Loaded default environment from ${envPath}`);

  } catch (error) {

    console.error(`Error loading default .env file: ${error.message}`);

    console.error('Continuing with default parameters or other configuration sources.');

  }

}



// Load parameters from environment variables

const envVarParams = {

  serviceName: process.env.SERVICE_NAME,

  namespace: process.env.NAMESPACE,

  serializationFormat: process.env.SERIALIZATION_FORMAT,

  className: process.env.CLASS_NAME,

  bootstrapServers: process.env.BOOTSTRAP_SERVERS,

  schemaRegistryUrl: process.env.SCHEMA_REGISTRY_URL,

  environment: process.env.ENVIRONMENT,

  region: process.env.REGION,

  confluentCloudApiKey: process.env.API_KEY,

  confluentCloudApiSecret: process.env.API_SECRET,

  useProtobuf: process.env.USE_PROTOBUF,

  specFile: process.env.SPEC_FILE

};



// Clean undefined values

Object.keys(envVarParams).forEach(key => {

  if (envVarParams[key] === undefined) {

    delete envVarParams[key];

  }

});



// Merge parameters in order of priority (lowest to highest priority)

// In spread syntax, later properties override earlier ones

const params = {

  ...defaultParams,           // Default parameters (lowest priority)

  ...envVarParams,            // Environment variables

  ...defaultConfigParams,     // Default configuration files

  ...configParams,            // Config file specified via command line

  ...envParams,               // Environment file (.env) specified via command line

  ...options.params           // Command line parameters (highest priority)

};



// Paths

// Use spec from command line first, then config file, then default

const specFile = options.spec || params.specFile || path.resolve(__dirname, 'sample-asyncapi.yaml');

const outputDir = options.output || path.resolve(__dirname, 'generated-output');



// Main function

async function main() {

  console.log('AsyncAPI C# Kafka Client Generation');

  console.log('----------------------------------------');

  console.log(`AsyncAPI spec: ${specFile}`);

  console.log(`Output directory: ${outputDir}`);



  try {

    // Ensure output directories exist

    if (!fs.existsSync(outputDir)) {

      fs.mkdirSync(outputDir, { recursive: true });

    }    // Load and parse AsyncAPI spec

    const rawSpec = await loadSpec(specFile);

    const spec = processSpec(rawSpec);    // Extract Kafka connection details from spec

    const kafkaServer = rawSpec.servers?.cluster;

    const schemaRegistryServer = rawSpec.servers?.['schema-registry'];



    // Extract security requirements if any

    const securitySchemes = rawSpec.components?.securitySchemes;

    const confluentBrokerSecurity = securitySchemes?.confluentBroker;

    const schemaRegistrySecurity = securitySchemes?.confluentSchemaRegistry;



    // Process channels information from spec

    const processedChannels = {};

    if (rawSpec.channels) {

      for (const [channelName, channelInfo] of Object.entries(rawSpec.channels)) {

        processedChannels[channelName] = {

          name: channelName,

          bindings: channelInfo.bindings || {},

          subscribe: channelInfo.subscribe || null

        };



        // Look for consumer group ID in subscribe operation

        if (channelInfo.subscribe?.bindings?.kafka?.groupId) {

          params.groupId = channelInfo.subscribe.bindings.kafka.groupId;

        }



        // Look for message format to determine serialization

        if (channelInfo.subscribe?.message?.$ref) {

          const messageRef = channelInfo.subscribe.message.$ref;

          if (messageRef.toLowerCase().includes('avro')) {

            params.serializationFormat = 'avro';

          } else if (messageRef.toLowerCase().includes('json')) {

            params.serializationFormat = 'json';

          }

        }

      }

    }



    // Update parameters for template

    params.channels = processedChannels;



    // Override connection parameters and security from AsyncAPI spec

    if (kafkaServer) {

      params.bootstrapServers = kafkaServer.url.replace(/^(kafka|https?):\/\//, ''); // Remove protocol prefixes if present

     

      // Extract and set security requirements

      if (kafkaServer.security && confluentBrokerSecurity) {

        params.confluentCloudApiKey = '${var.kafka_api_key}';

        params.confluentCloudApiSecret = '${var.kafka_api_secret}';

      }

    }

    if (schemaRegistryServer) {

      params.schemaRegistryUrl = schemaRegistryServer.url;



      // Extract and set schema registry security

      if (schemaRegistryServer.security && schemaRegistrySecurity) {

        params.schemaRegistryApiKey = '${var.schema_registry_api_key}';

        params.schemaRegistryApiSecret = '${var.schema_registry_api_secret}';

      }

    }



    console.log(`Parameters:`, JSON.stringify(params, null, 2));



    const srcDir = path.join(outputDir, 'src');

    const kafkaDir = path.join(srcDir, 'Kafka');

    const modelsDir = path.join(srcDir, 'Models');

    const serializationDir = path.join(srcDir, 'Serialization');

    const schemaDir = path.join(outputDir, 'schemas');

    const terraformDir = path.join(outputDir, 'terraform');



    // Create all required directories

    [srcDir, kafkaDir, modelsDir, serializationDir, schemaDir, terraformDir].forEach(dir => {

      if (!fs.existsSync(dir)) {

        fs.mkdirSync(dir, { recursive: true });

      }

    });



    // Register Handlebars helpers

    registerHelpers();



    // 1. Generate service project file

    const csprojTemplate = `<Project Sdk="Microsoft.NET.Sdk">



  <PropertyGroup>

    <OutputType>Exe</OutputType>

    <TargetFramework>net8.0</TargetFramework>

    <ImplicitUsings>enable</ImplicitUsings>

    <Nullable>enable</Nullable>

  </PropertyGroup>



  <ItemGroup>    <PackageReference Include="Confluent.Kafka" Version="2.3.0" />

    <PackageReference Include="Confluent.SchemaRegistry" Version="2.3.0" />

    <PackageReference Include="Confluent.SchemaRegistry.Serdes.Json" Version="2.3.0" />

    <PackageReference Include="Microsoft.Extensions.Configuration" Version="8.0.0" />

    <PackageReference Include="Microsoft.Extensions.Configuration.Abstractions" Version="8.0.0" />

    <PackageReference Include="Microsoft.Extensions.Configuration.Binder" Version="8.0.0" />

    <PackageReference Include="Microsoft.Extensions.Configuration.Json" Version="8.0.0" />

    <PackageReference Include="Microsoft.Extensions.DependencyInjection" Version="8.0.0" />

    <PackageReference Include="Microsoft.Extensions.Hosting" Version="8.0.0" />

    <PackageReference Include="Microsoft.Extensions.Logging" Version="8.0.0" />

    <PackageReference Include="Microsoft.Extensions.Logging.Console" Version="8.0.0" />

    <PackageReference Include="Microsoft.Extensions.Options" Version="8.0.0" />

    <PackageReference Include="Microsoft.Extensions.Options.ConfigurationExtensions" Version="8.0.0" />

    <PackageReference Include="Newtonsoft.Json" Version="13.0.3" />    ${params.serializationFormat === 'avro' || params.serializationFormat === 'both' ? '<PackageReference Include="Confluent.SchemaRegistry.Serdes.Avro" Version="2.3.0" />' : ''}

    ${params.useProtobuf === 'true' ? '<PackageReference Include="Confluent.SchemaRegistry.Serdes.Protobuf" Version="2.3.0" />' : ''}

    ${params.useProtobuf === 'true' ? '<PackageReference Include="Google.Protobuf" Version="3.25.1" />' : ''}

  </ItemGroup>



  <ItemGroup>

    <None Update="appsettings.json">

      <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>

    </None>

  </ItemGroup>



</Project>`;



    const csprojOutput = path.join(outputDir, `${params.serviceName}.csproj`);

    fs.writeFileSync(csprojOutput, csprojTemplate);

    console.log(`Generated: ${csprojOutput}`);    // 2. Generate appsettings.json using Handlebars template

    const appSettingsTemplatePath = path.join(path.resolve(__dirname, 'template'), 'appsettings.json.hbs');

    const appSettingsTemplateContent = fs.readFileSync(appSettingsTemplatePath, 'utf8');

    const appSettingsTemplate = handlebars.compile(appSettingsTemplateContent);

   

    // Prepare template parameters

    const templateParams = {

      ...params,

      channels: {},

      bootstrapServers: params.bootstrapServers,

      schemaRegistryUrl: params.schemaRegistryUrl,

      groupId: params.groupId

    };



    // Process channels from raw spec into the format needed by the template

    if (rawSpec.channels) {

      Object.entries(rawSpec.channels).forEach(([channelName, channelInfo]) => {

        templateParams.channels[channelName] = {

          name: channelName,

          bindings: channelInfo.bindings || {},

          subscribe: channelInfo.subscribe || null

        };

      });

    }



    const appSettingsContent = appSettingsTemplate(templateParams);

    const appSettingsOutput = path.join(outputDir, 'appsettings.json');

    fs.writeFileSync(appSettingsOutput, appSettingsContent);

    console.log(`Generated: ${appSettingsOutput}`);



    // 3. Generate C# model classes

    // For simplicity, we'll generate a single class based on the first message in the spec

    const messages = Object.values(spec.messages);

    if (messages.length > 0) {

      const firstMessage = messages[0];

      const className = params.className;

      const namespace = params.namespace;



      const classContent = generateCSharpClass(className, firstMessage.payload, `${namespace}.Models`);

      const classOutput = path.join(modelsDir, `${className}.cs`);

      fs.writeFileSync(classOutput, classContent);

      console.log(`Generated: ${classOutput}`);



      // 4. Generate schema files

      // 4.1 Generate Avro schema

      const avroSchema = generateAvroSchema(firstMessage.payload, className);

      const avroOutput = path.join(schemaDir, `${className}.avsc`);

      fs.writeFileSync(avroOutput, avroSchema);

      console.log(`Generated: ${avroOutput}`);



      // 4.2 Generate JSON schema

      const jsonSchema = generateJsonSchema(firstMessage.payload, className);

      const jsonOutput = path.join(schemaDir, `${className}.json`);

      fs.writeFileSync(jsonOutput, jsonSchema);

      console.log(`Generated: ${jsonOutput}`);



      // 4.3 Generate Protobuf schema if requested

      if (params.useProtobuf === 'true') {

        const protobufSchema = generateProtobufSchema(firstMessage.payload, className);

        const protobufOutput = path.join(schemaDir, `${className}.proto`);

        fs.writeFileSync(protobufOutput, protobufSchema);

        console.log(`Generated: ${protobufOutput}`);

      }

    }



    // 5. Generate serialization services

    // 5.1 Generate JSON serialization service

    if (params.serializationFormat === 'json' || params.serializationFormat === 'both') {

      const jsonSerializationTemplate = `using Confluent.Kafka;

using Newtonsoft.Json;

using System.Text;



namespace ${params.namespace}.Serialization

{

    public class JsonSerializationService

    {

        public static string Serialize<T>(T data)

        {

            return JsonConvert.SerializeObject(data);

        }



        public static T Deserialize<T>(string json)

        {

            return JsonConvert.DeserializeObject<T>(json);

        }

    }



    public class JsonSerializer<T> : ISerializer<T>

    {

        public byte[] Serialize(T data, SerializationContext context)

        {

            return Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(data));

        }

    }



    public class JsonDeserializer<T> : IDeserializer<T>

    {

        public T Deserialize(ReadOnlySpan<byte> data, bool isNull, SerializationContext context)

        {

            if (isNull)

                return default;



            var json = Encoding.UTF8.GetString(data);

            return JsonConvert.DeserializeObject<T>(json);

        }

    }

}`;



      const jsonSerializationOutput = path.join(serializationDir, 'JsonSerializationService.cs');

      fs.writeFileSync(jsonSerializationOutput, jsonSerializationTemplate);

      console.log(`Generated: ${jsonSerializationOutput}`);

    }



    // 5.2 Generate Avro serialization service

    if (params.serializationFormat === 'avro' || params.serializationFormat === 'both') {

      const avroSerializationTemplate = `using Confluent.Kafka;

using Confluent.SchemaRegistry;

using Confluent.SchemaRegistry.Serdes;



namespace ${params.namespace}.Serialization

{

    public class AvroSerializationService<T>

    {

        private readonly ISchemaRegistryClient _schemaRegistryClient;

        private readonly AvroSerializer<T> _serializer;

        private readonly AvroDeserializer<T> _deserializer;



        public AvroSerializationService(ISchemaRegistryClient schemaRegistryClient)

        {

            _schemaRegistryClient = schemaRegistryClient;

            _serializer = new AvroSerializer<T>(_schemaRegistryClient);

            _deserializer = new AvroDeserializer<T>(_schemaRegistryClient);

        }



        public async Task<byte[]> SerializeAsync(T data, SerializationContext context)

        {

            return await _serializer.SerializeAsync(data, context);

        }



        public async Task<T> DeserializeAsync(ReadOnlyMemory<byte> data, bool isNull, SerializationContext context)

        {

            return await _deserializer.DeserializeAsync(data, isNull, context);

        }

    }

}`;



      const avroSerializationOutput = path.join(serializationDir, 'AvroSerializationService.cs');

      fs.writeFileSync(avroSerializationOutput, avroSerializationTemplate);

      console.log(`Generated: ${avroSerializationOutput}`);

    }



    // 5.3 Generate Protobuf serialization service if requested

    if (params.useProtobuf === 'true') {

      const protobufSerializationTemplate = `using Confluent.Kafka;

using Confluent.SchemaRegistry;

using Confluent.SchemaRegistry.Serdes;

using Google.Protobuf;



namespace ${params.namespace}.Serialization

{

    public class ProtobufSerializationService<T> where T : IMessage<T>, new()

    {

        private readonly ISchemaRegistryClient _schemaRegistryClient;

        private readonly ProtobufSerializer<T> _serializer;

        private readonly ProtobufDeserializer<T> _deserializer;



        public ProtobufSerializationService(ISchemaRegistryClient schemaRegistryClient)

        {

            _schemaRegistryClient = schemaRegistryClient;

            _serializer = new ProtobufSerializer<T>(_schemaRegistryClient);

            _deserializer = new ProtobufDeserializer<T>();

        }



        public async Task<byte[]> SerializeAsync(T data, SerializationContext context)

        {

            return await _serializer.SerializeAsync(data, context);

        }



        public T Deserialize(ReadOnlySpan<byte> data, bool isNull, SerializationContext context)

        {

            return _deserializer.Deserialize(data, isNull, context);

        }

    }

}`;



      const protobufSerializationOutput = path.join(serializationDir, 'ProtobufSerializationService.cs');

      fs.writeFileSync(protobufSerializationOutput, protobufSerializationTemplate);

      console.log(`Generated: ${protobufSerializationOutput}`);

    }



    // 6. Generate KafkaConsumerService.cs

    const consumerTemplate = `using Confluent.Kafka;

using Confluent.Kafka.SyncOverAsync;

using Confluent.SchemaRegistry;

using Confluent.SchemaRegistry.Serdes;

using Microsoft.Extensions.Configuration;

using Microsoft.Extensions.Hosting;

using Microsoft.Extensions.Logging;

using ${params.namespace}.Models;

using ${params.namespace}.Serialization;

using Newtonsoft.Json;

using System;

using System.Threading;

using System.Threading.Tasks;



namespace ${params.namespace}.Kafka

{

    public class KafkaConsumerService : BackgroundService

    {

        private readonly IConfiguration _configuration;

        private readonly ILogger<KafkaConsumerService> _logger;



        public KafkaConsumerService(IConfiguration configuration, ILogger<KafkaConsumerService> logger)

        {

            _configuration = configuration;

            _logger = logger;

        }



        protected override async Task ExecuteAsync(CancellationToken stoppingToken)

        {

            var config = new ConsumerConfig

            {

                BootstrapServers = _configuration["Kafka:BootstrapServers"],

                GroupId = _configuration["Kafka:ConsumerGroup"],

                AutoOffsetReset = AutoOffsetReset.Earliest,

                EnableAutoCommit = false

            };



            // Choose serialization format based on configuration

            string serializationFormat = _configuration["Kafka:SerializationFormat"] ?? "json";

            IConsumer<string, object> consumer;

           

            if (serializationFormat.ToLower() == "avro")

            {

                var schemaRegistryConfig = new SchemaRegistryConfig

                {

                    Url = _configuration["Kafka:SchemaRegistryUrl"]

                };



                var schemaRegistry = new CachedSchemaRegistryClient(schemaRegistryConfig);

                consumer = new ConsumerBuilder<string, object>(config)

                    .SetValueDeserializer(new AvroDeserializer<object>(schemaRegistry).AsSyncOverAsync())

                    .SetErrorHandler((_, e) => _logger.LogError($"Error: {e.Reason}"))

                    .Build();

            }

            else

            {

                consumer = new ConsumerBuilder<string, object>(config)

                    .SetValueDeserializer(new JsonDeserializer<object>())

                    .SetErrorHandler((_, e) => _logger.LogError($"Error: {e.Reason}"))

                    .Build();

            }



            var topic = _configuration["Kafka:Topic"];

            consumer.Subscribe(topic);



            try

            {

                while (!stoppingToken.IsCancellationRequested)

                {

                    try

                    {

                        var consumeResult = consumer.Consume(stoppingToken);

                       

                        // Handle message based on serialization format

                        object message = consumeResult.Message.Value;

                       

                        _logger.LogInformation($"Received message: {JsonConvert.SerializeObject(message)}");

                       

                        // Here you would process the message

                        // TODO: Implement your message processing logic

                       

                        // Commit the offset

                        consumer.Commit(consumeResult);

                    }

                    catch (ConsumeException e)

                    {

                        _logger.LogError($"Consume error: {e.Error.Reason}");

                    }

                }

            }

            catch (OperationCanceledException)

            {

                // Graceful shutdown

            }

            finally

            {

                consumer.Close();

            }

        }

    }

}`;



    const consumerOutput = path.join(kafkaDir, 'KafkaConsumerService.cs');

    fs.writeFileSync(consumerOutput, consumerTemplate);

    console.log(`Generated: ${consumerOutput}`);



    // 7. Generate KafkaProducerService.cs

    const producerTemplate = `using Confluent.Kafka;

using Confluent.SchemaRegistry;

using Confluent.SchemaRegistry.Serdes;

using Microsoft.Extensions.Configuration;

using Microsoft.Extensions.Logging;

using ${params.namespace}.Models;

using ${params.namespace}.Serialization;

using Newtonsoft.Json;

using System;

using System.Threading.Tasks;



namespace ${params.namespace}.Kafka

{

    public class KafkaProducerService

    {

        private readonly IConfiguration _configuration;

        private readonly ILogger<KafkaProducerService> _logger;

        private readonly IProducer<string, string> _jsonProducer;

        private readonly IProducer<string, ${params.className}> _avroProducer;

        private readonly string _topic;



        public KafkaProducerService(IConfiguration configuration, ILogger<KafkaProducerService> logger)

        {

            _configuration = configuration;

            _logger = logger;

            _topic = _configuration["Kafka:Topic"];



            var producerConfig = new ProducerConfig

            {

                BootstrapServers = _configuration["Kafka:BootstrapServers"],

                Acks = Acks.All

            };



            // Create JSON producer

            _jsonProducer = new ProducerBuilder<string, string>(producerConfig).Build();

           

            // Create Avro producer

            var schemaRegistryConfig = new SchemaRegistryConfig

            {

                Url = _configuration["Kafka:SchemaRegistryUrl"]

            };



            var schemaRegistry = new CachedSchemaRegistryClient(schemaRegistryConfig);

            _avroProducer = new ProducerBuilder<string, ${params.className}>(producerConfig)

                .SetValueSerializer(new AvroSerializer<${params.className}>(schemaRegistry))

                .Build();

        }



        public async Task ProduceJsonAsync(string key, ${params.className} message)

        {

            try

            {

                var json = JsonConvert.SerializeObject(message);

                var deliveryResult = await _jsonProducer.ProduceAsync(_topic, new Message<string, string>

                {

                    Key = key,

                    Value = json

                });



                _logger.LogInformation($"Delivered JSON message to {deliveryResult.TopicPartitionOffset}");

            }

            catch (ProduceException<string, string> e)

            {

                _logger.LogError($"JSON delivery failed: {e.Error.Reason}");

            }

        }



        public async Task ProduceAvroAsync(string key, ${params.className} message)

        {

            try

            {

                var deliveryResult = await _avroProducer.ProduceAsync(_topic, new Message<string, ${params.className}>

                {

                    Key = key,

                    Value = message

                });



                _logger.LogInformation($"Delivered Avro message to {deliveryResult.TopicPartitionOffset}");

            }

            catch (ProduceException<string, ${params.className}> e)

            {

                _logger.LogError($"Avro delivery failed: {e.Error.Reason}");

            }

        }



        public async Task ProduceAsync(string key, ${params.className} message, string format = null)

        {

            // Use configured format if not specified

            format = format ?? _configuration["Kafka:SerializationFormat"] ?? "json";

           

            if (format.ToLower() == "avro")

            {

                await ProduceAvroAsync(key, message);

            }

            else

            {

                await ProduceJsonAsync(key, message);

            }

        }



        public void Dispose()

        {

            _jsonProducer?.Dispose();

            _avroProducer?.Dispose();

        }

    }

}`;



    const producerOutput = path.join(kafkaDir, 'KafkaProducerService.cs');

    fs.writeFileSync(producerOutput, producerTemplate);

    console.log(`Generated: ${producerOutput}`);



    // 8. Generate Program.cs

    const programContent = `using Microsoft.Extensions.Configuration;

using Microsoft.Extensions.DependencyInjection;

using Microsoft.Extensions.Hosting;

using Microsoft.Extensions.Logging;

using ${params.namespace}.Kafka;

using ${params.namespace}.Models;

using System.Threading.Tasks;



namespace ${params.namespace}

{

    public class Program

    {

        public static async Task Main(string[] args)

        {

            var host = CreateHostBuilder(args).Build();

           

            // Get the producer service

            var producer = host.Services.GetRequiredService<KafkaProducerService>();

            var logger = host.Services.GetRequiredService<ILogger<Program>>();

           

            // Create and send a sample message

            var message = new ${params.className}

            {

                // TODO: Initialize your message

            };

           

            // Send both JSON and Avro messages as examples

            await producer.ProduceJsonAsync("sample-key", message);

            await producer.ProduceAvroAsync("sample-key", message);

           

            // Run the consumer service

            await host.RunAsync();

        }



        public static IHostBuilder CreateHostBuilder(string[] args) =>

            Host.CreateDefaultBuilder(args)

                .ConfigureAppConfiguration((hostContext, config) =>

                {

                    config.AddJsonFile("appsettings.json", optional: false);

                })

                .ConfigureServices((hostContext, services) =>

                {

                    services.AddHostedService<KafkaConsumerService>();

                    services.AddSingleton<KafkaProducerService>();

                });

    }

}`;



    const programOutput = path.join(srcDir, 'Program.cs');

    fs.writeFileSync(programOutput, programContent);

    console.log(`Generated: ${programOutput}`);

   

    // 9. Generate Terraform scripts

    generateTerraformScripts(rawSpec, terraformDir, params);



    console.log('\nCode generation completed successfully!');

    console.log(`Output is available in: ${outputDir}`);



  } catch (error) {

    console.error(`Error during generation: ${error.message}`);

    console.error(error.stack);

    process.exit(1);

  }

}



// Function to parse command-line parameters

function parseParams(paramString) {

  const result = {};

  if (!paramString) return result;

 

  const pairs = paramString.split(',');

  for (const pair of pairs) {

    const [name, value] = pair.split('=');

    if (name && value) {

      result[name.trim()] = value.trim();

    }

  }

  return result;

}



// Load AsyncAPI specification

function loadSpec(filePath) {

  try {

    const fileContent = fs.readFileSync(filePath, 'utf8');

    if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) {

      return yaml.load(fileContent);

    } else if (filePath.endsWith('.json')) {

      return JSON.parse(fileContent);

    } else {

      throw new Error('Unsupported file format. Please provide a YAML or JSON AsyncAPI specification.');

    }

  } catch (error) {

    console.error(`Error loading AsyncAPI specification: ${error.message}`);

    process.exit(1);

  }

}



// Process AsyncAPI spec to extract channels, messages, etc.

function processSpec(spec) {

  const result = {

    info: spec.info || {},

    servers: spec.servers || {},

    channels: {},

    messages: {}

  };

 

  // Process channels

  if (spec.channels) {

    for (const [channelName, channel] of Object.entries(spec.channels)) {

      result.channels[channelName] = {

        name: channelName,

        publish: channel.publish,

        subscribe: channel.subscribe

      };

    }

  }

 

  // Process messages and schemas

  if (spec.components && spec.components.messages) {

    for (const [messageName, message] of Object.entries(spec.components.messages)) {

      let payload = message.payload;

     

      // If payload is a reference, resolve it

      if (payload && payload.$ref) {

        const refPath = payload.$ref.split('/');

        const schemaName = refPath[refPath.length - 1];

        payload = spec.components.schemas[schemaName];

      }

     

      result.messages[messageName] = {

        name: messageName,

        payload: payload,

        bindings: message.bindings

      };

    }

  }

 

  return result;

}



// Register Handlebars helpers

function registerHelpers() {

  // Check equality

  handlebars.registerHelper('eq', function(a, b) {

    return a === b;

  });

 

  // Convert to PascalCase

  handlebars.registerHelper('pascalCase', function(str) {

    if (!str) return '';

    return str

      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => word.toUpperCase())

      .replace(/\s+/g, '')

      .replace(/[^\w]/g, '');

  });

 

  // Convert to camelCase

  handlebars.registerHelper('camelCase', function(str) {

    if (!str) return '';

    return str

      .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase())

      .replace(/\s+/g, '')

      .replace(/[^\w]/g, '');

  });

}



// Generate C# class from schema

function generateCSharpClass(className, schema, namespace) {

  if (!schema) {

    return `namespace ${namespace}

{

    public class ${className}

    {

        // No schema defined

    }

}`;

  }



  let classContent = `using System;

using Newtonsoft.Json;

using System.ComponentModel.DataAnnotations;



namespace ${namespace}

{

    public class ${className}

    {

`;



  // Handle fields array (Avro style)

  if (schema.fields) {

    for (const field of schema.fields) {

      const propertyName = field.name.charAt(0).toUpperCase() + field.name.slice(1);

      let propertyType = getCSharpTypeFromAvro(field.type);

      const isNullable = Array.isArray(field.type) && field.type.includes('null');

     

      // Add XML documentation if available

      if (field.doc) {

        classContent += `        /// <summary>\n`;

        classContent += `        /// ${field.doc}\n`;

        classContent += `        /// </summary>\n`;

      }



      // Add validation attributes

      if (field.type && typeof field.type === 'object' && field.type.maxLength) {

        classContent += `        [StringLength(${field.type.maxLength})]\n`;

      }

      if (!isNullable && field.default === undefined) {

        classContent += `        [Required]\n`;

      }

     

      // Add property with Json property name

      classContent += `        [JsonProperty("${field.name}")]\n`;

      classContent += `        public ${propertyType}${isNullable ? '?' : ''} ${propertyName} { get; set; }\n\n`;

    }

  }

  // Handle properties object (JSON Schema style)

  else if (schema.properties) {

    for (const [propName, propSchema] of Object.entries(schema.properties)) {

      const propertyType = getCSharpType(propSchema);

      const propertyName = propName.charAt(0).toUpperCase() + propName.slice(1);

      const isRequired = schema.required && schema.required.includes(propName);

     

      if (propSchema.description) {

        classContent += `        /// <summary>\n`;

        classContent += `        /// ${propSchema.description}\n`;

        classContent += `        /// </summary>\n`;

      }

     

      if (isRequired) {

        classContent += `        [Required]\n`;

      }



      if (propSchema.maxLength) {

        classContent += `        [StringLength(${propSchema.maxLength})]\n`;

      }

     

      classContent += `        [JsonProperty("${propName}")]\n`;

      classContent += `        public ${propertyType} ${propertyName} { get; set; }\n\n`;

    }

  }

 

  classContent += `    }\n}`;

  return classContent;

}



// Map Avro types to C# types

function getCSharpTypeFromAvro(avroType) {

  if (Array.isArray(avroType)) {

    // Handle union types, e.g. ["null", "string"] -> string

    const nonNullType = avroType.find(t => t !== 'null');

    return getCSharpTypeFromAvro(nonNullType);

  }



  if (typeof avroType === 'object') {

    if (avroType.type === 'string') {

      return 'string';

    }

    if (avroType.type === 'array') {

      const itemType = getCSharpTypeFromAvro(avroType.items);

      return `List<${itemType}>`;

    }

    if (avroType.logicalType === 'timestamp-millis') {

      return 'DateTime';

    }

    return getCSharpTypeFromAvro(avroType.type);

  }



  switch (avroType) {

    case 'string':

      return 'string';

    case 'int':

      return 'int';

    case 'long':

      return 'long';

    case 'float':

      return 'float';

    case 'double':

      return 'double';

    case 'boolean':

      return 'bool';

    case 'bytes':

      return 'byte[]';

    default:

      return 'string';

  }

}



// Generate Avro schema from AsyncAPI schema

function generateAvroSchema(schema, name) {

  const avroSchema = {

    type: 'record',

    name: name,

    fields: []

  };

 

  // Check for fields array directly under payload (Avro style)

  if (schema && schema.fields) {

    avroSchema.fields = schema.fields.map(field => {

      // Convert any SQL-style types to Avro types

      if (Array.isArray(field.type)) {

        const avroType = field.type.map(t => {

          if (t === 'null') return t;

          // Handle SQL types

          if (t.logicalType === 'varchar' || t.logicalType === 'char') {

            return {

              type: 'string',

              maxLength: t.maxLength

            };

          }

          return t;

        });

        return {

          ...field,

          type: avroType

        };

      } else {

        // Simple type

        return {

          ...field,

          type: typeof field.type === 'object' && (field.type.logicalType === 'varchar' || field.type.logicalType === 'char')

            ? {

                type: 'string',

                maxLength: field.type.maxLength

              }

            : field.type

        };

      }

    });

  }

  // Handle JSON Schema style properties

  else if (schema && schema.properties) {

    for (const [propName, propSchema] of Object.entries(schema.properties)) {

      const field = {

        name: propName,

        type: getAvroType(propSchema, propName)

      };

     

      if (propSchema.description) {

        field.doc = propSchema.description;

      }

     

      // Handle required fields

      if (!schema.required || !schema.required.includes(propName)) {

        field.default = null;

        field.type = ['null', field.type];

      }

     

      avroSchema.fields.push(field);

    }

  }

 

  return JSON.stringify(avroSchema, null, 2);

}



// Map JSON Schema types to Avro types

function getAvroType(schema, name) {

  if (!schema || !schema.type) return "string";

 

  switch (schema.type) {

    case 'string':

      if (schema.format === 'date-time' || schema.format === 'date') {

        return { type: 'long', logicalType: 'timestamp-millis' };

      }

      if (schema.format === 'uuid') {

        return { type: 'string', logicalType: 'uuid' };

      }

      // Handle SQL-style types

      if (schema.logicalType === 'varchar' || schema.logicalType === 'char') {

        return { type: 'string', maxLength: schema.maxLength };

      }

      return 'string';

    case 'integer':

      if (schema.format === 'int64') return 'long';

      if (schema.logicalType === 'int') return 'int';

      return 'int';

    case 'number':

      if (schema.format === 'float') return 'float';

      return 'double';

    case 'boolean':

      return 'boolean';

    case 'array':

      return {

        type: 'array',

        items: schema.items ? getAvroType(schema.items) : 'string'

      };

    case 'object':

      // For nested objects, create a new record

      const fields = [];

      if (schema.properties) {

        for (const [propName, propSchema] of Object.entries(schema.properties)) {

          fields.push({

            name: propName,

            type: getAvroType(propSchema, propName)

          });

        }

      }

      return {

        type: 'record',

        name: `${name}Record`,

        fields: fields

      };

    default:

      return 'string';

  }

}



// Generate JSON Schema from AsyncAPI schema

function generateJsonSchema(schema, name) {

  // AsyncAPI schemas are already compatible with JSON Schema

  const jsonSchema = {

    $schema: "http://json-schema.org/draft-07/schema#",

    title: name,

    type: "object",

    properties: schema.properties || {},

    required: schema.required || []

  };

 

  return JSON.stringify(jsonSchema, null, 2);

}



// Generate Protocol Buffer schema from AsyncAPI schema

function generateProtobufSchema(schema, name) {

  let protobufContent = `syntax = "proto3";\n\n`;

  protobufContent += `package ${name.toLowerCase()};\n\n`;

  protobufContent += `import "google/protobuf/timestamp.proto";\n\n`;

  protobufContent += `message ${name} {\n`;

 

  let fieldIndex = 1;

 

  if (schema && schema.properties) {

    for (const [propName, propSchema] of Object.entries(schema.properties)) {

      const fieldType = getProtobufType(propSchema);

     

      // Add comment if description exists

      if (propSchema.description) {

        protobufContent += `  // ${propSchema.description}\n`;

      }

     

      protobufContent += `  ${fieldType} ${propName} = ${fieldIndex};\n`;

      fieldIndex++;

    }

  }

 

  protobufContent += `}\n`;

  return protobufContent;

}



// Map JSON Schema types to Protocol Buffer types

function getProtobufType(schema) {

  if (!schema || !schema.type) return "string";

 

  switch (schema.type) {

    case 'string':

      if (schema.format === 'date-time' || schema.format === 'date') {

        return 'google.protobuf.Timestamp';

      }

      return 'string';

    case 'integer':

      if (schema.format === 'int64') return 'int64';

      return 'int32';

    case 'number':

      if (schema.format === 'float') return 'float';

      return 'double';

    case 'boolean':

      return 'bool';

    case 'array':

      const itemType = schema.items ? getProtobufType(schema.items) : 'string';

      return `repeated ${itemType}`;

    case 'object':

      // For nested objects, we'd need to create another message type

      // This is a simplified approach

      return 'map<string, string>';

    default:

      return 'string';

  }

}



// Generate Terraform scripts for Kafka topics and Schema Registry

function generateTerraformScripts(spec, outputDir, params) {

  // Extract Kafka info from AsyncAPI spec

  const kafkaServer = spec.servers?.cluster;

  const schemaRegistryServer = spec.servers?.['schema-registry'];

  const kafkaRegion = kafkaServer?.url.match(/\.([a-z]+)\.azure\.confluent\.cloud/)?.[1] || params.region;



  // Generate provider configuration

  const providerFile = path.join(outputDir, 'providers.tf');

  const providerContent = `terraform {

  required_providers {

    confluent = {

      source  = "confluentinc/confluent"

      version = "1.51.0"

    }

  }

}



# Provider configuration with separate API keys for Kafka and Schema Registry

provider "confluent" {

  kafka_api_key            = var.kafka_api_key

  kafka_api_secret         = var.kafka_api_secret

  schema_registry_api_key  = var.schema_registry_api_key

  schema_registry_secret   = var.schema_registry_api_secret

}



# Variables for API keys and secrets

variable "kafka_api_key" {

  type        = string

  description = "Kafka API Key from Confluent Cloud"

  sensitive   = true

}



variable "kafka_api_secret" {

  type        = string

  description = "Kafka API Secret from Confluent Cloud"

  sensitive   = true

}



variable "schema_registry_api_key" {

  type        = string

  description = "Schema Registry API Key from Confluent Cloud"

  sensitive   = true

}



variable "schema_registry_api_secret" {

  type        = string

  description = "Schema Registry API Secret from Confluent Cloud"

  sensitive   = true

}



variable "environment" {

  type        = string

  description = "Environment name (dev, staging, prod)"

  default     = "${params.environment}"

}`;

 

  fs.writeFileSync(providerFile, providerContent);

  console.log(`Generated: ${providerFile}`);

 

  // Generate Kafka cluster and topics

  const topicsFile = path.join(outputDir, 'kafka_topics.tf');

  let topicsContent = `# Kafka cluster and topics configuration

resource "confluent_environment" "main" {

  display_name = "\${var.environment}"

}



resource "confluent_kafka_cluster" "main" {

  display_name = "\${var.environment}-cluster"

  availability = "SINGLE_ZONE"

  cloud        = "AZURE"

  region       = "${kafkaRegion}"

  basic {}  # Using basic as it's sufficient for most use cases

  environment {

    id = confluent_environment.main.id

  }

}



resource "confluent_service_account" "app_manager" {

  display_name = "app-manager-\${var.environment}"

  description  = "Service account for managing Kafka resources"

}



resource "confluent_role_binding" "app_manager_environment_admin" {

  principal   = "User:\${confluent_service_account.app_manager.id}"

  role_name   = "EnvironmentAdmin"

  crn_pattern = confluent_environment.main.resource_name

}



resource "confluent_api_key" "app_manager_kafka_api_key" {

  display_name = "app-manager-kafka-api-key"

  description  = "Kafka API Key for app manager"

  owner {

    id          = confluent_service_account.app_manager.id

    api_version = confluent_service_account.app_manager.api_version

    kind        = confluent_service_account.app_manager.kind

  }



  managed_resource {

    id          = confluent_kafka_cluster.main.id

    api_version = confluent_kafka_cluster.main.api_version

    kind        = confluent_kafka_cluster.main.kind

    environment {

      id = confluent_environment.main.id

    }

  }

}



# Schema Registry

resource "confluent_schema_registry_cluster" "main" {

  package = "ESSENTIALS"

  environment {

    id = confluent_environment.main.id

  }

  region {

    # Schema Registry region from AsyncAPI spec or default

    id = "sgreg-${schemaRegistryServer?.url.match(/\.([a-z]+)\.azure\.confluent\.cloud/)?.[1] || params.region}"

  }

}



resource "confluent_service_account" "schema_registry_account" {

  display_name = "schema-registry-\${var.environment}"

  description  = "Service account for Schema Registry access"

}



resource "confluent_role_binding" "schema_registry_resource_owner" {

  principal   = "User:\${confluent_service_account.schema_registry_account.id}"

  role_name   = "ResourceOwner"

  crn_pattern = "\${confluent_schema_registry_cluster.main.resource_name}/subject=*"

}



resource "confluent_api_key" "schema_registry_api_key" {

  display_name = "schema-registry-api-key"

  description  = "Schema Registry API Key"

  owner {

    id          = confluent_service_account.schema_registry_account.id

    api_version = confluent_service_account.schema_registry_account.api_version

    kind        = confluent_service_account.schema_registry_account.kind

  }



  managed_resource {

    id          = confluent_schema_registry_cluster.main.id

    api_version = confluent_schema_registry_cluster.main.api_version

    kind        = confluent_schema_registry_cluster.main.kind

    environment {

      id = confluent_environment.main.id

    }

  }

}



# Kafka Topics\n`;



  // Extract topics from AsyncAPI channels with their configurations

  if (spec.channels) {

    let topicIndex = 1;

    for (const [channelName, channel] of Object.entries(spec.channels)) {

      const topicName = channelName;

      const channelConfig = channel.bindings?.kafka;

     

      // Extract topic configuration from AsyncAPI spec

      const topicConfig = {};

      if (channelConfig) {

        // Map standard Kafka configs

        if (channelConfig.partitions) {

          topicConfig["num.partitions"] = channelConfig.partitions.toString();

        }

        if (channelConfig.replicas) {

          topicConfig["replication.factor"] = channelConfig.replicas.toString();

        }



        // Map topic configuration

        if (channelConfig.topicConfiguration) {

          Object.entries(channelConfig.topicConfiguration).forEach(([key, value]) => {

            topicConfig[key] = value.toString();

          });

        }



        // Map additional x-configs

        if (channelConfig["x-configs"]) {

          Object.entries(channelConfig["x-configs"]).forEach(([key, value]) => {

            topicConfig[key] = value.toString();

          });

        }

      }



      topicsContent += `

resource "confluent_kafka_topic" "topic_${topicIndex}" {

  kafka_cluster {

    id = confluent_kafka_cluster.main.id

  }

  topic_name    = "${topicName}"

  rest_endpoint = confluent_kafka_cluster.main.rest_endpoint

  credentials {

    key    = confluent_api_key.app_manager_kafka_api_key.id

    secret = confluent_api_key.app_manager_kafka_api_key.secret

  }

 

  config = {

${Object.entries(topicConfig).map(([key, value]) => `    "${key}" = "${value}"`).join('\n')}

  }

}\n`;

      topicIndex++;

    }

  }



  fs.writeFileSync(topicsFile, topicsContent);

  console.log(`Generated: ${topicsFile}`);



  // Generate Schema Registry subjects

  const schemasFile = path.join(outputDir, 'schemas.tf');

  let schemasContent = `# Schema Registry Subjects\n`;



  if (spec.components?.messages) {

    let schemaIndex = 1;

    for (const [messageName, message] of Object.entries(spec.components.messages)) {

      // Determine schema format from AsyncAPI spec

      const schemaFormat = message.schemaFormat || 'application/vnd.apache.avro;version=1.9.0';

      const format = schemaFormat.includes('avro') ? 'AVRO' :

                    schemaFormat.includes('protobuf') ? 'PROTOBUF' :

                    'JSON';

     

      schemasContent += `

resource "confluent_schema" "schema_${schemaIndex}" {

  schema_registry_cluster {

    id = confluent_schema_registry_cluster.main.id

  }

  rest_endpoint = confluent_schema_registry_cluster.main.rest_endpoint

  subject_name  = "${messageName}"

  format        = "${format}"

  schema        = file("\${path.module}/../schemas/${message.name || messageName}.${format.toLowerCase() === 'avro' ? 'avsc' : format.toLowerCase()}")

  credentials {

    key    = confluent_api_key.schema_registry_api_key.id

    secret = confluent_api_key.schema_registry_api_key.secret

  }

}\n`;

      schemaIndex++;

    }

  }

 

  fs.writeFileSync(schemasFile, schemasContent);

  console.log(`Generated: ${schemasFile}`);



  // Generate outputs for easy access to connection information

  const outputsFile = path.join(outputDir, 'outputs.tf');

  const outputsContent = `# Terraform outputs

output "bootstrap_servers" {

  description = "Kafka bootstrap servers"

  value       = confluent_kafka_cluster.main.bootstrap_endpoint

  sensitive   = true

}



output "schema_registry_url" {

  description = "Schema Registry URL"

  value       = confluent_schema_registry_cluster.main.rest_endpoint

  sensitive   = true

}



output "kafka_cluster_id" {

  description = "Kafka Cluster ID"

  value       = confluent_kafka_cluster.main.id

  sensitive   = true

}



output "schema_registry_cluster_id" {

  description = "Schema Registry Cluster ID"

  value       = confluent_schema_registry_cluster.main.id

  sensitive   = true

}



output "environment_id" {

  description = "Confluent Environment ID"

  value       = confluent_environment.main.id

  sensitive   = true

}\n`;

 

  fs.writeFileSync(outputsFile, outputsContent);

  console.log(`Generated: ${outputsFile}`);

}



// Run the main function

main().catch(console.error);
