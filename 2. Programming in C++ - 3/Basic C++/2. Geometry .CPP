// Geometric  -- area of defferent size
#include<iostream>
using namespace std;
struct Geometry{

       float A;
       float B;
       float C;
       float P= 3.1416;

};
int main()
{
    Geometry Rg ;
    cout << "Enter Base =" ;
    cin >> Rg.A ;
      cout << "Enter Height =" ;
    cin >> Rg.B ;
    cout << "Enter  =" ;
    cin >> Rg.C ;

     cout<< "The area of a rectangle =" << Rg.A*Rg.B << endl << endl ;
     cout<< "The area of a Circle =" << Rg.C*Rg.C*Rg.P << endl << endl;
     cout<< "The area of a Trapezium =" << 0.5*(Rg.A + Rg.B)*Rg.C << endl;

}
