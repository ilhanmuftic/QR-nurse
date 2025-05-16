import { CameraView, CameraType, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useState } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View, Alert, Modal, TextInput } from 'react-native';

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
  });

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
      // Split by % delimiter
      const parts = data.split('%');

      if (parts.length >= 5) {
        return {
          jmbg: parts[0],        // First part is JMBG
          name: parts[1],         // Second part is name
          surname: parts[2],      // Third part is surname
          dateOfBirth: parts[3],  // Fourth part is date of birth
          gender: parts[4],       // Fifth part is gender
          // The remaining parts appear to be additional codes/info
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
        [
          {
            text: "OK",
            onPress: () => setScanned(false),
          },
        ]
      );
    }
  };

  const handleAddToQueue = async () => {
    if (!patientData) {
      Alert.alert("Error", "No patient data available to add to the queue.");
      return;
    }

    const payload = {
      doctorId: "e23cfc0d-efca-459e-a751-1d131a32b6dc", // Replace with actual doctorId as needed
      jmbg: patientData.jmbg,
      hospitalId: 1, // Replace with the actual hospital ID
      firstName: patientData.name,
      lastName: patientData.surname,
    };

    try {
      const response = await fetch('https://hkmeashdtfncnsxqhgob.functions.supabase.co/insert_to_queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        Alert.alert("Success", "Patient has been added to the queue.");
      } else {
        const errorData = await response.json();
        Alert.alert("Error", `Failed to add patient to the queue: ${errorData.message || response.statusText}`);
      }
    } catch (error) {
      Alert.alert("Error", `An error occurred: ${error}`);
    }

    setShowPatientScreen(false);
    setScanned(false);
  };


  const handleAddParameters = () => {
    setShowPatientScreen(false);
    setShowParametersForm(true);
  };

  const handleSubmitParameters = () => {
    Alert.alert("Parameters Saved", "Patient parameters have been recorded");
    setShowParametersForm(false);
    setScanned(false);
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

                {/* Display additional codes if they exist */}
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
                    style={[styles.actionButton, styles.queueButton]}
                    onPress={handleAddToQueue}
                  >
                    <Text style={styles.buttonText}>Add to Queue</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.parametersButton]}
                    onPress={handleAddParameters}
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

            <TouchableOpacity
              style={[styles.actionButton, styles.submitButton]}
              onPress={handleSubmitParameters}
            >
              <Text style={styles.buttonText}>Submit</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}


const styles = StyleSheet.create({
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