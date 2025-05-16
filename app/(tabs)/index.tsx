import { CameraView, CameraType, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useState } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Alert, Modal, TextInput } from 'react-native';
import { supabase } from '../../utils/supabase';

interface PatientData {
  jmbg: string;
  name: string;
  surname: string;
  dateOfBirth: string;
  gender: string;
  additionalCode1?: string;
  additionalCode2?: string;
  additionalCode3?: string;
}

export default function HomeScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [showPatientScreen, setShowPatientScreen] = useState(false);
  const [showParametersForm, setShowParametersForm] = useState(false);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [parameters, setParameters] = useState({
    weight: '',
    height: '',
    bloodPressure: '',
    temperature: '',
    pulse: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  const parsePatientData = (data: string): PatientData | null => {
    try {
      const parts = data.split('%');
      if (parts.length >= 5) {
        return {
          jmbg: parts[0],
          name: parts[1],
          surname: parts[2],
          dateOfBirth: parts[3],
          gender: parts[4],
          additionalCode1: parts[5] || '',
          additionalCode2: parts[6] || '',
          additionalCode3: parts[7] || ''
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  const handleBarCodeScanned = ({ data }: BarcodeScanningResult) => {
    setScanned(true);
    const parsedData = parsePatientData(data);

    if (parsedData) {
      setPatientData(parsedData);
      setShowPatientScreen(true);
    } else {
      Alert.alert(
        "Invalid QR Code",
        "The scanned QR code doesn't contain valid patient data",
        [{ text: "OK", onPress: () => setScanned(false) }]
      );
    }
  };

  const handleAddToQueue = async () => {
    if (!patientData) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('queue')
        .insert([{
          jmbg: patientData.jmbg,
          first_name: patientData.name,
          last_name: patientData.surname,
          date_of_birth: patientData.dateOfBirth,
          gender: patientData.gender,
          status: 'waiting',
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      Alert.alert("Success", "Patient added to queue");
      setShowPatientScreen(false);
      setScanned(false);
    } catch (error) {
      Alert.alert("Error", "Failed to add patient to queue");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddParameters = () => {
    setShowPatientScreen(false);
    setShowParametersForm(true);
  };

  const handleSubmitParameters = async () => {
    if (!patientData) return;

    setIsLoading(true);
    try {
      // First, check if patient exists or create them
      const { error: upsertError } = await supabase
        .from('patients')
        .upsert({
          jmbg: patientData.jmbg,
          name: patientData.name,
          surname: patientData.surname,
          date_of_birth: patientData.dateOfBirth,
          gender: patientData.gender,
          updated_at: new Date().toISOString()
        }, { onConflict: 'jmbg' });

      if (upsertError) throw upsertError;

      // Then add the parameters
      const { error: paramsError } = await supabase
        .from('patient_parameters')
        .insert({
          patient_jmbg: patientData.jmbg,
          weight: parameters.weight,
          height: parameters.height,
          blood_pressure: parameters.bloodPressure,
          temperature: parameters.temperature,
          pulse: parameters.pulse,
          recorded_at: new Date().toISOString()
        });

      if (paramsError) throw paramsError;

      Alert.alert("Success", "Patient parameters saved");
      setShowParametersForm(false);
      setScanned(false);
      setParameters({
        weight: '',
        height: '',
        bloodPressure: '',
        temperature: '',
        pulse: '',
      });
    } catch (error) {
      Alert.alert("Error", "Failed to save parameters");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {!showPatientScreen && !showParametersForm && (
        <CameraView
          style={styles.camera}
          facing={facing}
          barcodeScannerSettings={{
            barcodeTypes: ['datamatrix', 'qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        >
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.button} onPress={toggleCameraFacing}>
              <Text style={styles.text}>Flip Camera</Text>
            </TouchableOpacity>
          </View>
        </CameraView>
      )}

      {/* Patient Data Modal */}
      <Modal
        visible={showPatientScreen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowPatientScreen(false);
          setScanned(false);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            {patientData && (
              <>
                <Text style={styles.modalTitle}>Patient Information</Text>
                <Text style={styles.patientText}>JMBG: {patientData.jmbg}</Text>
                <Text style={styles.patientText}>Name: {patientData.name}</Text>
                <Text style={styles.patientText}>Surname: {patientData.surname}</Text>
                <Text style={styles.patientText}>Date of Birth: {patientData.dateOfBirth}</Text>
                <Text style={styles.patientText}>Gender: {patientData.gender}</Text>

                {patientData.additionalCode1 && (
                  <Text style={styles.additionalCode}>Code 1: {patientData.additionalCode1}</Text>
                )}
                {patientData.additionalCode2 && (
                  <Text style={styles.additionalCode}>Code 2: {patientData.additionalCode2}</Text>
                )}
                {patientData.additionalCode3 && (
                  <Text style={styles.additionalCode}>Code 3: {patientData.additionalCode3}</Text>
                )}

                <View style={styles.buttonGroup}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.queueButton, isLoading && styles.disabledButton]}
                    onPress={handleAddToQueue}
                    disabled={isLoading}
                  >
                    <Text style={styles.buttonText}>
                      {isLoading ? 'Adding...' : 'Add to Queue'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.parametersButton, isLoading && styles.disabledButton]}
                    onPress={handleAddParameters}
                    disabled={isLoading}
                  >
                    <Text style={styles.buttonText}>Add Parameters</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Parameters Form Modal */}
      <Modal
        visible={showParametersForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowParametersForm(false);
          setScanned(false);
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Patient Parameters</Text>

            <TextInput
              style={styles.input}
              placeholder="Weight (kg)"
              keyboardType="numeric"
              value={parameters.weight}
              onChangeText={(text) => setParameters({ ...parameters, weight: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Height (cm)"
              keyboardType="numeric"
              value={parameters.height}
              onChangeText={(text) => setParameters({ ...parameters, height: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Blood Pressure (mmHg)"
              value={parameters.bloodPressure}
              onChangeText={(text) => setParameters({ ...parameters, bloodPressure: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Temperature (°C)"
              keyboardType="numeric"
              value={parameters.temperature}
              onChangeText={(text) => setParameters({ ...parameters, temperature: text })}
            />

            <TextInput
              style={styles.input}
              placeholder="Pulse (bpm)"
              keyboardType="numeric"
              value={parameters.pulse}
              onChangeText={(text) => setParameters({ ...parameters, pulse: text })}
            />

            <TouchableOpacity
              style={[styles.actionButton, styles.submitButton, isLoading && styles.disabledButton]}
              onPress={handleSubmitParameters}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Saving...' : 'Submit Parameters'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
  disabledButton: {
    opacity: 0.6,
  },
  additionalCode: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'transparent',
    margin: 64,
  },
  button: {
    flex: 1,
    alignSelf: 'flex-end',
    alignItems: 'center',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  patientText: {
    fontSize: 16,
    marginBottom: 10,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  actionButton: {
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  queueButton: {
    backgroundColor: '#4CAF50',
  },
  parametersButton: {
    backgroundColor: '#2196F3',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    marginTop: 15,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 10,
    borderRadius: 5,
  },
});